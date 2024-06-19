// Import the necessary modules
import { WebSocketServer } from "ws";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

// Load environment config
dotenv.config();

// Create MySQL pool
const mysqlOptions = {
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 10,
};
if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === "true") {
    mysqlOptions.ssl = {
        rejectUnauthorized: true,
    };
}
const pool = mysql.createPool(mysqlOptions);

const wss = new WebSocketServer({ port: 1234 });

wss.on("connection", function connection(ws) {
    ws.on("error", console.error);

    ws.on("message", function message(data) {
        console.log("received: %s", data);
    });

    ws.send("something");
});

// import dgram from "dgram";
// const server = dgram.createSocket("udp4");

// server.on("error", (err) => {
//     console.error(`server error:\n${err.stack}`);
//     server.close();
// });

// server.on("message", (msg, rinfo) => {
//     console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
// });

// server.on("listening", () => {
//     const address = server.address();
//     console.log(`server listening ${address.address}:${address.port}`);
// });

// server.on("connect", (client) => {
//     console.log(`${client.address}:${client.port} connected!`);
// });

// server.bind(1234);
