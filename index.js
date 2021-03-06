import joi from "joi";
import cors from "cors"
import chalk from "chalk";
import dayjs from "dayjs";
import dotenv from "dotenv";
import express from "express"
import { stripHtml } from "string-strip-html";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

let dbUol;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();

promise.then(()=> {
  dbUol = mongoClient.db(process.env.DATABASE);
})

promise.catch(e => console.log(chalk.bold.red('Não foi possível estabelecer a conexão com o servidor'), e));

const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", async (req, res) => {
  let {name} = req.body;

  const schema = joi.object({
      username: joi.string()
      .required()
  });

  const {error, value} = schema.validate({username: name}, {abortEarly: false});
  
  if(error !== undefined){
    res.status(422).send(error.details.map(message => message.message));
    return
  }

  name = stripHtml(name).result;
  name = name.trim();

  try{
    const usersCollection = dbUol.collection("users");
    const usersArray = await usersCollection.find({}).toArray();
    const usernamesArray  = usersArray.map(username => username.name)

    const alreadyLoggedIn = usernamesArray.find((user) => {
      if(user === name){
        return true;
      }else{
        return false
      }
    });

    if(alreadyLoggedIn){
      res.sendStatus(409);
      console.log(chalk.bold.red("Usuário já cadastrado"));
      return
    }

    await usersCollection.insertOne({name: name, lastStatus: Date.now()});
    const messagesCollection = dbUol.collection("messages");
    await messagesCollection.insertOne({from:name, to:'Todos', text: 'entra na sala...', type: 'status', time:dayjs().format('HH:mm:ss')});

    res.sendStatus(201);
  }catch (e) {
    console.log(e);
    res.send("Erro");
  }

})

app.get("/participants", async (req,res) => {
  try{
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
    const participants = await usersCollection.find({}).toArray();
    res.status(200).send(participants);
  }catch (e) {
    console.log(e);
    res.send("Erro");
  }
})

app.post("/messages", async (req, res) => {
  let {to, text, type} = req.body;
  let {user} = req.headers;

  try{
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
    const usersArray = await usersCollection.find({}).toArray();
    const usernamesArray = usersArray.map(username => username.name)
    let userFrom = usernamesArray.filter((username) => {
        return user === username
    });

    userFrom = userFrom.toString()

    const schema = joi.object({
      to: joi.string()
      .required(),
      text: joi.string()
      .required(),
      type: joi.string().valid('message', 'private_message').required(),
      from: joi.any().valid(userFrom)
    })
    
    const {error, value} = schema.validate({to: to, text: text, type: type, from: user}, {abortEarly: false} );

    if(error !== undefined){
      res.status(422).send(error.details.map(message => message.message));
      return
    }

    to = stripHtml(to).result
    to = to.trim();

    text = stripHtml(text).result
    text = text.trim();

    type = stripHtml(type).result
    type = type.trim();

    user = stripHtml(user).result
    user = user.trim();

    const messagesCollection = dbUol.collection("messages");
    await messagesCollection.insertOne({to: to, text: text, type: type, from: user, time: dayjs().format('HH:mm:ss')})
    res.status(201).send({name:user});
  }catch (e){
    console.log(e)
    res.sendStatus(500);
  }
})

app.get('/messages', async (req, res) => {  
  const {limit} = req.query;
  const {user} = req.headers;

  try{
    const dbUol = mongoClient.db('batepapouol');
    const messagesCollection = dbUol.collection('messages');
    const messagesArray = await messagesCollection.find({}).toArray();

    const messagesForUser = messagesArray.filter((message) => {
      if(message.type === 'message' || message.type === 'status' || message.to === user || message.from === user){
        return message;
      }
    })
    
    if(!limit){
      res.status(200).send(messagesForUser)
      return
    }

    res.status(200).send(messagesForUser.slice(-limit));
  }catch(e){
    res.sendStatus(500);
  }

})

app.post('/status', async (req,res) => {
  const {user} = req.headers;
  
  try{
    const dbUol = mongoClient.db('batepapouol');
    const usersCollection = dbUol.collection('users');

    const selectedUser = await usersCollection.findOne({name: user});

    if(selectedUser === null){
      res.sendStatus(404);
      return
    }

    await usersCollection.updateOne({
      name: selectedUser.name
    }, 
      {$set: {lastStatus: Date.now()}} )

    res.sendStatus(200)
  }catch (e){
    res.sendStatus(500);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const {user} = req.headers;
  const {id} = req.params;
  
  try{
    const dbUol = mongoClient.db('batepapouol');
    const messagesCollection = dbUol.collection('messages');
    const messagesArray = await messagesCollection.find({_id: new ObjectId(id)}).toArray();
    
    if(messagesArray.length === 0){
      res.sendStatus(404);
      return;
    }

    if(messagesArray[0].from !== user){
      console.log(messagesArray)
      res.sendStatus(401)
      return
    }

    await messagesCollection.deleteOne({_id: new ObjectId(id)});
    res.sendStatus(200);
  } catch (e){
    res.sendStatus(500);
    console.log(e);
  }

});

app.put("/messages/:id", async (req, res) => {
  let {to, text, type} = req.body;
  let {user} = req.headers;
  const {id} = req.params;

  try{
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
    const usersArray = await usersCollection.find({}).toArray();
    const usernamesArray = usersArray.map(username => username.name)
    let userFrom = usernamesArray.filter((username) => {
        return user === username
    });

    userFrom = userFrom.toString()

    const schema = joi.object({
      to: joi.string()
      .required(),
      text: joi.string()
      .required(),
      type: joi.string().valid('message', 'private_message').required(),
      from: joi.any().valid(userFrom)
    })
    
    const {error, value} = schema.validate({to: to, text: text, type: type, from: user}, {abortEarly: false} );

    if(error !== undefined){
      res.status(422).send(error.details.map(message => message.message));
      return
    }

    const messagesCollection = dbUol.collection("messages");
    const messagesArray = await messagesCollection.find({_id: new ObjectId(id)}).toArray();
    
    if(messagesArray.length === 0){
      res.sendStatus(404);
      return;
    }

    if(messagesArray[0].from !== user){
      res.sendStatus(401)
      return
    }

    const message = messagesCollection.find({_id: new ObjectId(id)})

    await messagesCollection.updateOne({_id: new ObjectId(id)}, {
      $set: {text: text}
    })
    res.sendStatus(200);
  }catch (e){
    console.log(e)
    res.sendStatus(500);
  }
})

setInterval(async () => {
  try{
    const dbUol = mongoClient.db('batepapouol');
    const usersCollection = dbUol.collection('users');
    const messagesCollection = dbUol.collection('messages');
    const usersArray = await usersCollection.find({}).toArray();
    const usersExpired = usersArray.filter((user) => {
      return Date.now() - parseInt(user.lastStatus) > 10000;
    })

    usersExpired.forEach((user) => {
      messagesCollection.insertOne({to: 'Todos', text: 'sai da sala...', type: 'status', from: user.name, time: dayjs().format('HH:mm:ss')});
      usersCollection.deleteOne({_id: new ObjectId(user._id)});
    })
    
  }catch (e){
    console.log(e);
  }
}, 15000)

app.listen(5000,()=>console.log(chalk.bold.green("Servidor rodando na porta 5000!")));