import express from "express"
import cors from "cors"
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", async (req, res) => { //Validação com JOI do nome do usuario. Não pode ser uma string vazia e também não pode ser igual a de um nome ja existente no banco de dados!
  const {name} = req.body;

  try{
    await mongoClient.connect();
    const dbUol = mongoClient.db("batepapouol");
    const usersCollection = dbUol.collection("users");
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

app.listen(5000,()=>console.log(chalk.bold.green("Servidor rodando na porta 5000!")));