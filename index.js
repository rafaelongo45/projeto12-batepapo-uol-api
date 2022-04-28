import express from "express"
import cors from "cors"
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db

const promise = mongoClient.connect()
promise.then(() => db = mongoClient.db("batepapouol"));
promise.catch((e) => console.log(chalk.bold.red("Não foi possível acessar a database", e)));

const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", (req, res) => { //Trocar para o formato que o diego mostrou na aula hj
  const {name} = req.body;

  //Validação com JOI do nome do usuario. Não pode ser uma string vazia e também não pode ser igual a de um nome ja existente no banco de dados!

  const promise = db.collection("users").insertOne({name: name, lastStatus: Date.now()});

  promise.then(() => {
    
    const promise2 = db.collection("messages").insertOne({from:name, to:'Todos', text: 'entra na sala...', type: 'status', time:dayjs().format('HH:mm:ss')});

    promise2.then((answer) => {
      res.status(201); 
      res.send(answer);
    });

    promise2.catch((e) => {
      console.log(e);
      res.send("Deu ruim");
    });

  });

  promise.catch((e) => {
    console.log(e);
    res.send("Deu ruim");
  });
})

app.get("/participants", (req,res) => {
  const promise = db.collection("users").find({}).toArray();

  promise.then((participants) => {
    res.status(200).send(participants);
  })

  promise.catch((e) => {
    console.log(chalk.bold.red("Não foi possível pegar a lista de participantes"), e);
    res.sendStatus(404);
  })
})

app.listen(5000,()=>console.log(chalk.bold.green("Servidor rodando na porta 5000!")));