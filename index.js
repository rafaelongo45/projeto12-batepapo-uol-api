import joi from "joi";
import cors from "cors"
import chalk from "chalk";
import dayjs from "dayjs";
import dotenv from "dotenv";
import express from "express"
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", async (req, res) => {
  const {name} = req.body;
  const schema = joi.object({
      username: joi.string()
      .required()
  });

  const {error, value} = schema.validate({username: name});
  
  if(error !== undefined){
    console.log(chalk.bold.red(error.details[0].message))
    res.sendStatus(422);
    return
  }

  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db("batepapouol");
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
      console.log("Usuário já cadastrado")
      return
    }

    await usersCollection.insertOne({name: name, lastStatus: Date.now()});
    const messagesCollection = dbUol.collection("messages");
    await messagesCollection.insertOne({from:name, to:'Todos', text: 'entra na sala...', type: 'status', time:dayjs().format('HH:mm:ss')});

    res.sendStatus(201);
    mongoClient.close();
  }catch (e) {
    console.log(e);

    res.send("Deu ruim");
    mongoClient.close();
  }

})

app.get("/participants", async (req,res) => {
  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
    const participants = await usersCollection.find({}).toArray();
    
    res.status(200).send(participants);
    mongoClient.close();
  }catch (e) {
    console.log(e);

    res.send("Deu ruim");
    mongoClient.close();
  }
})

app.post("/messages", async (req, res) => { //Falta fazer a validação com joi verificando se um usuario ja existe no banco de dados. Ta caindo erro 500 ao inves de 422
  const {to, text, type} = req.body;
  const {user} = req.headers;

  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
    const usersArray = await usersCollection.find({}).toArray();
    const usernamesArray = usersArray.map(username => username.name)
    let userFrom = await usernamesArray.filter((username) => {
        return user === username
    });
    userFrom = userFrom.toString()
    const schema = joi.object({
      to: joi.string()
      .required(),
      text: joi.string()
      .required(),
      type: joi.string().valid('message', 'private_message'),
      from: joi.any().valid(userFrom)
    })
    
    const {error, value} = schema.validate({to: to, text: text, type: type, from: user} );

    if(error !== undefined){
      res.sendStatus(422);
      return
    }

    const messagesCollection = dbUol.collection("messages");
    await messagesCollection.insertOne({to: to, text: text, type: type, from: user, time: dayjs().format('HH:mm:ss')})
    
    res.sendStatus(201);
    mongoClient.close();
  }catch (e){
    console.log(e)

    res.sendStatus(500);
    mongoClient.close();
  }
})

app.get('/messages', async (req, res) => {
  const {limit} = req.query;
  const {user} = req.headers;

  try{
    await mongoClient.connect();
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

    mongoClient.close();
  }catch(e){
    res.sendStatus(500);
    mongoClient.close();
  }

})

app.post('/status', async (req,res) => {
  const {user} = req.headers;

  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db('batepapouol');
    const usersCollection = dbUol.collection('users');

    const selectedUser = await usersCollection.findOne({name: user});

    if(!selectedUser){
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

    mongoClient.close();
  }
});

// setInterval(async () => {
//   try{
//     mongoClient.connect();
//     const dbUol = mongoClient.db('batepapouol');
//     const usersCollection = dbUol.collection('users');
//     const usersArray = await usersCollection.find({}).toArray();
//     const usersExpired = usersArray.filter((user) => {
//       return Date.now() - parseInt(user.lastStatus) > 10000;
//     })
    
//     usersExpired.forEach((userData) => {
//       usersCollection.deleteOne({_id: new Object(userData._id)});
//     })
//     console.log(usersExpired)
//     mongoClient.close()
//   }catch (e){
//     console.log(e);
//     mongoClient.close()
//   }
// }, 15000)

app.listen(5000,()=>console.log(chalk.bold.green("Servidor rodando na porta 5000!")));