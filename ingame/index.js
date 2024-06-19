// Import the necessary modules
import http from "http";
import Socketio from "socket.io";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { generatePartyKey, hashPlayerIp } from "./utils.js";

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

let socket = new WebSocket("wss://localhost:3003/");

socket.onopen = function (e) {
    alert("[open] Connection established");
    alert("Sending to server");
    socket.send("My name is John");
};

socket.onmessage = function (event) {
    alert(`[message] Data received from server: ${event.data}`);
};

socket.onclose = function (event) {
    if (event.wasClean) {
        alert(
            `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
        );
    } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        alert("[close] Connection died");
    }
};

socket.onerror = function (error) {
    alert(`[error]`);
};
