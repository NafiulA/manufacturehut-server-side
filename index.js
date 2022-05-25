const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9h6ig.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();

        const database = client.db("manufacturehut");
        const productCollection = database.collection("products");
        const userCollection = database.collection("users");
        const orderCollection = database.collection("orders");
        const reviewCollection = database.collection("reviews");

        async function verifyAdmin(req, res, next) {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === "admin") {
                next();
            }
            else {
                res.status(403).send({ message: "Forbidden Access" });
            }
        }

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


        app.post("/order", verifyJWT, async (req, res) => {
            const body = req.body;
            const result = await orderCollection.insertOne(body);
            res.send(result);
        });

        app.put("/updateQuantity/:id", verifyJWT, async (req, res) => {
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
        });

        app.get("/user", verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/user/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        app.put("/profile/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const body = req.body;
            const query = { email: email };
            const updateDoc = {
                $set: body
            };
            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.get("/admin/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user.role === "admin";
            res.send({ admin: isAdmin });
        });

        app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            };
            const result = await userCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.get("/myorder/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await orderCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.findOne(query);
            res.send(result);
        });

        app.post("/createPaymentIntent", verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });

        app.put("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const query = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    payment: "paid",
                    shipment: "pending",
                    transactionId: body.transactionId
                }
            };
            const result = await orderCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.delete("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.post("/review", verifyJWT, async (req, res) => {
            const body = req.body;
            const result = await reviewCollection.insertOne(body);
            res.send(result);
        });

        app.get("/review", async (req, res) => {
            const query = {};
            const result = await reviewCollection.find(query).toArray();
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