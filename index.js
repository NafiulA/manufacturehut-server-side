const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9h6ig.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();

        const database = client.db("manufacturehut");
        const productCollection = database.collection("products");
        const userCollection = database.collection("users");
        const orderCollection = database.collection("orders");

        app.get("/products", async (req, res) => {
            const query = {}
            const products = await productCollection.find(query).toArray();
            res.send(products);
        });

        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const body = req.body;
            const query = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: body,
            };
            const result = await userCollection.updateOne(query, updateDoc, options);
            const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ result, accessToken });
        });

        app.get("/product/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result);
        });


        app.post("/order", async (req, res) => {
            const body = req.body;
            const result = await orderCollection.insertOne(body);
            res.send(result);
        });

        app.put("/updateQuantity/:id", async (req, res) => {
            const id = req.params.id;
            const quantity = req.query.quantity;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $inc: {
                    stock: -quantity,
                },
            }
            const result = await productCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("server running");
});

app.listen(port, () => {
    console.log("listening to ", port);
});