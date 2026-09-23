// # index.js -> 

const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = 7000;
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "0.0.0.0"]);


// cors connection --------------------------------
// const allowedOrigins = [
//   "",
//   "",
// ];

app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin || true); 
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true
}));

app.use(express.json());

//  key from env file -----------------
const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbAppName = process.env.DB_APPNAME;

// ###########################################################

// MongoDB connection Function --------------------------------
const { MongoClient, ServerApiVersion } = require('mongodb');
// const uri = `mongodb+srv://<db_username>:<db_password>@cluster0.qtemx5j.mongodb.net/?appName=Cluster0`;
const uri = `mongodb+srv://${dbUsername}:${dbPassword}@cluster0.qtemx5j.mongodb.net/?appName=${dbAppName}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// ###########################################################

// routes import secton ----------------
const usersRoutes = require('./routes/users/users') ;
const appointmentsRoutes= require("./routes/appointments/appointments") ;


async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

// ###########################################################

// database collection ---------------------
  const db = client.db(dbAppName) ;
 const usersCollection = db.collection("users") ;
 const appointmentsCollection= db.collection("appointments")
// Define Routes secton ---------------------------
  app.use("/users", usersRoutes(usersCollection));
app.use("/appointments", appointmentsRoutes(appointmentsCollection))

// ###########################################################


app.get('/', (req, res) => {
  res.send('Example running properly!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});