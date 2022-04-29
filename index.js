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
    const userFrom = await usernamesArray.find((username) => {
      if(user === username){
        return username
      }
    });

    const schema = joi.object({
      to: joi.string()
      .required(),
      text: joi.string()
      .required(),
      type: joi.string().valid('message', 'private_message'),
      from: joi.any().valid(userFrom)
    })
    
    const {error, value} = schema.validate({to: to, text: text, type: type, from: user} );
    console.log(error)

    if(error !== undefined){
      console.log(error)
      res.sendStatus(422);
      return
    }

    const messagesCollection = dbUol.collection("messages");
    await messagesCollection.insertOne({to: to, text: text, type: type, from: user, time: dayjs().format('HH:mm:ss')})
    
    res.sendStatus(201);
    mongoClient.close();
  }catch (e){
    res.sendStatus(500);
    mongoClient.close();
  }
})

app.get('/messages', async (req, res) => {
  const {limit} = req.query;

  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db('batepapouol');
    const messagesCollection = dbUol.collection('messages');
    const messagesArray = await messagesCollection.find({}).toArray();
    
    if(!limit){
      res.status(200).send(messagesArray)
      return
    }

    res.status(200).send(messagesArray.slice(-limit));

    mongoClient.close();
  }catch(e){
    res.sendStatus(500);
    mongoClient.close();
  }

})

app.listen(5000,()=>console.log(chalk.bold.green("Servidor rodando na porta 5000!")));