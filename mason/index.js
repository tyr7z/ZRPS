// Import the necessary modules
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { parse } from "url";
import { randomBytes } from "crypto";
import { inspect } from "util";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { WebSocketServer } from "ws";
import * as dotenv from "dotenv";
import mysql from "mysql2/promise";
import { generatePartyKey, hashPlayerIp } from "./utils.js";
import EventEmitter from "events";

// Load environment config
dotenv.config();

const gameServerDetails = {
    version: 736,
    mode: "Solo",
    status: "Lobby",
    players: 1,
    ipv4: "127.0.0.1:3003",
    ipv6: "::1",
    enabled: true,
    proxyIndex: null,
    hostname: "localhost:3003",
    hostnameV4: "localhost:3003",
    endpoint: "",
    endpoints: null,
    hostnames: null,
    hostnamesV4: null,
    discreteFourierTransformBias: 13,
    id: "",
};

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

// Shared proxied Mason server
const wss = new WebSocketServer({ noServer: true });

// WebSocket upgrade handler (shared for both HTTP and HTTPS)
function handleUpgrade(server) {
    server.on("upgrade", (req, socket, head) => {
        const { pathname, query } = parse(req.url, true);
        console.log(`Upgrade on ${pathname}`, query);
        console.log(req.url);

        if (pathname === "/gateway/" && query.EIO === "4" && query.transport === "websocket") {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req);
            });
        } else {
            socket.destroy();
        }
    });
}

function parseSocketIOMessage(message) {
    try {
        // Remove the leading "42" and parse the rest of the message as JSON
        const jsonData = JSON.parse(message.slice(2));

        // Extract the event name and data from the parsed JSON
        const eventName = jsonData[0];
        const eventData = jsonData[1];

        return { eventName, eventData };
    } catch {
        return null;
    }
}

// Define players and parties object
const players = {};
const parties = {};

/*
// HTTPS Mason server
const httpsMasonServer = createHttpsServer({
    key: readFileSync("privatekey.pem"),
    cert: readFileSync("certificate.pem"),
});
handleUpgrade(httpsMasonServer);
httpsMasonServer.listen(parseInt(process.env.PORT || "3002"), process.env.HOST || "127.0.0.1", () => {
    console.log(
        `[${process.env.SERVER_NAME || "ZRPS"}] Mason is now listening on https://${
            process.env.HOST || "127.0.0.1"
        }:${process.env.PORT || "3002"}`
    );
});
*/

// HTTP Mason server
const httpMasonServer = createHttpServer();
handleUpgrade(httpMasonServer);
httpMasonServer.listen(parseInt(process.env.PORT || "3002"), process.env.HOST || "127.0.0.1", () => {
    console.log(
        `[${process.env.SERVER_NAME || "ZRPS"}] Mason is now listening on http://${
            process.env.HOST || "127.0.0.1"
        }:${process.env.PORT || "3002"}`
    );
});

// Set up a listener for the connection event
// @ts-ignore
wss.on("connection", (socket, req) => {
    console.log("A player has connected");
    
    const sid = [...crypto.getRandomValues(new Uint8Array(20))].map(n => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[n % 62]).join('');

    socket.id = sid;
    players[socket.id] = {
        loginState: 0,
        socket: socket,
    };
    
    // 1. Engine.IO handshake packet
    const handshake = `0${JSON.stringify({
        sid,
        upgrades: [],
        pingInterval: 55000,
        pingTimeout: 120000
    })}`;
    console.log("⬅️ From server: ", handshake);
    socket.send(handshake);

    // 2. Socket.IO connect packet
    console.log("⬅️ From server: ", "40");
    socket.send("40");
    
    // 3. Handle messages from client
    socket.on("message", (payload) => {
        const msg = payload.toString();
        console.log("➡️ From client:", msg);

        if (msg === "2") { // ping
            console.log("⬅️ From server: ", "3");
            socket.send("3"); // pong
        } else if (msg.startsWith("42")) {
            const { eventName, eventData } = parseSocketIOMessage(msg);
            socket.emit(eventName, eventData);
        } else {
            console.error("❌ Invalid message:", msg);
        }
    });

    // Create Socket.IO event listeners
    socket.on("setPlatform", (platform) => {
        if (!platform) return socket.disconnect(true);
        if (typeof platform !== "string") return socket.disconnect(true);
        players[socket.id].platform = platform;
    });

    socket.on("setVersion", (version) => {
        if (!version) return socket.disconnect(true);
        if (typeof version !== "string") return socket.disconnect(true);
        players[socket.id].version = version;
    });

    socket.on("setName", (name) => {
        if (!name) return socket.disconnect(true);
        if (typeof name !== "string") return socket.disconnect(true);
        players[socket.id].name = name;
    });

    socket.on("setStatus", async (status) => {
        if (!status) return socket.disconnect(true);
        if (typeof status !== "string") return socket.disconnect(true);
        if (players[socket.id].loginState !== 2) return;
        if (!["online", "ingame"].includes(status)) return;
        const userId = players[socket.id].userData.id;
        const friendCode = players[socket.id].userData.friend_code;
        const connection = await pool.getConnection();
        connection.execute("UPDATE users " + "SET status = ?, updated = NOW() " + "WHERE id = ?", [status, userId]);
        // Notify friends
        const [friendIds] = await connection.execute(
            "SELECT u.id " +
                "FROM friends f " +
                "JOIN users u ON (f.user_id = u.id AND f.friend_id = ?) OR (f.friend_id = u.id AND f.user_id = ?) " +
                "WHERE f.user_id = ? OR f.friend_id = ?",
            [userId, userId, userId, userId]
        );
        const [updatedFriend] = await connection.execute(
            "SELECT u.id, u.friend_code, u.friend_code as name, u.avatar, u.updated, u.status " +
                "FROM friends f " +
                "JOIN users u ON u.friend_code = ? " +
                "WHERE f.user_id = ? OR f.friend_id = ? " +
                "LIMIT 1",
            [friendCode, userId, userId]
        );
        // @ts-ignore
        if (updatedFriend.length === 0) return connection.release();
        const playersById = {};
        Object.values(players).forEach((player) => {
            playersById[player.userData?.id] = player;
        });
        // @ts-ignore
        friendIds.forEach((friend) => {
            const player = playersById[friend.id];
            if (player) {
                player.socket.send(`42["friendUpdated", ${JSON.stringify(updatedFriend[0])}]`);
            }
        });
        connection.release();
    });

    socket.on("sendFriendRequest", async (friendCode) => {
        if (!friendCode) return;
        if (typeof friendCode !== "string") return socket.disconnect(true);
        if (players[socket.id].loginState !== 2) return;
        const userId = players[socket.id].userData.id;
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                "INSERT INTO friendreqs (sender_id, receiver_id) " +
                    "SELECT ?, id " +
                    "FROM users " +
                    "WHERE friend_code = ? AND id != ?",
                [userId, friendCode, userId]
            );
            const [rows] = await connection.execute(
                "SELECT f.receiver_id, u.friend_code, u.friend_code as name, u.avatar, f.created_at as sent " +
                    "FROM friendreqs f " +
                    "JOIN users u ON f.sender_id = u.id " +
                    "WHERE f.sender_id = ? AND f.receiver_id = (SELECT id FROM users WHERE friend_code = ?)",
                [userId, friendCode]
            );
            // @ts-ignore
            if (rows.length === 0) return connection.release();
            const fr = rows[0];
            const receiverId = fr.receiver_id;
            delete fr.receiver_id;
            const receivingPlayer = Object.values(players).find((p) => p.userData?.id === receiverId);
            if (receivingPlayer) {
                receivingPlayer.socket.send(`42["friendRequestReceived", ${JSON.stringify(fr)}]`);
            }
        } catch {}
        connection.release();
    });

    socket.on("acceptFriendRequest", async (friendCode) => {
        if (!friendCode) return socket.disconnect(true);
        if (typeof friendCode !== "string") return socket.disconnect(true);
        if (players[socket.id].loginState !== 2) return;
        const userData = players[socket.id].userData;
        const connection = await pool.getConnection();
        try {
            await connection.query("START TRANSACTION");
            const response = await connection.execute(
                "INSERT INTO friends (user_id, friend_id) " +
                    "SELECT u.id, fr.receiver_id " +
                    "FROM friendreqs fr " +
                    "INNER JOIN users u ON fr.sender_id = u.id " +
                    "WHERE fr.receiver_id = ? AND fr.sender_id = (SELECT id FROM users WHERE friend_code = ?)",
                [userData.id, friendCode]
            );
            // @ts-ignore
            if (response[0].affectedRows === 0) return connection.release();
            const response2 = await connection.execute(
                "DELETE fr " +
                    "FROM friendreqs fr " +
                    "INNER JOIN users u ON fr.sender_id = u.id " +
                    "WHERE fr.receiver_id = ? AND fr.sender_id = (SELECT id FROM users WHERE friend_code = ?)",
                [userData.id, friendCode]
            );
            // @ts-ignore
            if (response2[0].affectedRows === 0) return connection.release();
            await connection.query("COMMIT");
            const [friend1] = await connection.execute(
                "SELECT u.id, u.friend_code, u.friend_code as name, u.avatar, u.updated, u.status " +
                    "FROM friends f " +
                    "JOIN users u ON u.friend_code = ? " +
                    "WHERE f.user_id = ? OR f.friend_id = ?",
                [friendCode, userData.id, userData.id]
            );
            // @ts-ignore
            if (friend1.length === 0) return connection.release();
            socket.send(`42["friendUpdated", ${JSON.stringify(friend1[0])}]`);
            const [friend2] = await connection.execute(
                "SELECT u.id, u.friend_code, u.friend_code as name, u.avatar, u.updated, u.status " +
                    "FROM friends f " +
                    "JOIN users u ON u.id = ? " +
                    "WHERE f.user_id = ? OR f.friend_id = ?",
                [userData.id, friend1[0].id, friend1[0].id]
            );
            // @ts-ignore
            if (friend2.length === 0) return connection.release();
            const otherPlayer = Object.values(players).find((p) => p.userData?.id === friend1[0].id);
            if (otherPlayer) {
                otherPlayer.socket.send(`42["friendUpdated", ${JSON.stringify(friend2[0])}]`);
            }
            connection.release();
        } catch {
            await connection.query("ROLLBACK");
            connection.release();
        }
    });

    socket.on("rejectFriendRequest", async (friendCode) => {
        if (!friendCode) return socket.disconnect(true);
        if (typeof friendCode !== "string") return socket.disconnect(true);
        if (players[socket.id].loginState !== 2) return;
        const userId = players[socket.id].userData.id;
        const connection = await pool.getConnection();
        const response = await connection.execute(
            "DELETE FROM friendreqs " +
                "WHERE receiver_id = ? AND sender_id = (SELECT id FROM users WHERE friend_code = ?)",
            [userId, friendCode]
        );
        connection.release();
        // @ts-ignore
        if (response[0].affectedRows === 0) return;
        socket.send(`42["friendRequestRejected", ${JSON.stringify({
            friend_code: friendCode,
        })}]`);
    });

    socket.on("deleteFriend", async (friendId) => {
        if (!friendId) return socket.disconnect(true);
        if (typeof friendId !== "string") return socket.disconnect(true);
        if (players[socket.id].loginState !== 2) return;
        friendId = parseInt(friendId);
        if (isNaN(friendId)) return socket.disconnect(true);
        const userId = players[socket.id].userData.id;
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT * from friends " + "WHERE (user_id = ? AND friend_id = ?) OR (friend_id = ? AND user_id = ?)",
            [userId, friendId, userId, friendId]
        );
        // @ts-ignore
        if (rows.length === 0) return connection.release();
        const friendEntry = rows[0];
        const otherId = friendEntry.user_id === userId ? friendEntry.friend_id : friendEntry.user_id;
        const response = await connection.execute("DELETE FROM friends " + "WHERE id = ?", [friendEntry.id]);
        connection.release();
        // @ts-ignore
        if (response[0].affectedRows === 0) return;
        socket.send(`42["friendDeleted", ${JSON.stringify({
            id: friendId,
        })}]`);
        const otherPlayer = Object.values(players).find((p) => p.userData?.id === otherId);
        if (otherPlayer) {
            otherPlayer.socket.send(`42["friendDeleted", ${JSON.stringify({
                id: userId,
            })}]`);
        }
    });

    socket.on("createParty", () => {
        const partyKey = generatePartyKey();
        const now = Date.now();
        parties[partyKey] = {
            key: partyKey,
            created: now,
            updated: now,
            state: "waiting",
            autofill: true,
            platform: null,
            version: null,
            region: null,
            gameMode: "Solo",
            metadata: "{}",
            players: [
                {
                    id: socket.id,
                    name: players[socket.id].name,
                    useIp: hashPlayerIp(req.socket.remoteAddress),
                    isMobile: players[socket.id].platform === "android" || players[socket.id].platform === "ios",
                    inRound: false,
                    ready: false,
                    leader: true,
                },
            ],
        };
        players[socket.id].partyKey = partyKey;
        socket.send(`42["partyData", ${JSON.stringify(parties[partyKey])}]`);
    });

    socket.on("setPartyVersion", (version) => {
        if (!version) return socket.disconnect(true);
        if (typeof version !== "string") return socket.disconnect(true);
        const partyKey = players[socket.id].partyKey;
        if (!partyKey) return;
        const party = parties[partyKey];
        if (!party) return;
        const partyPlayer = party.players.find((player) => player.id === socket.id);
        if (!partyPlayer?.leader) return;
        party.version = version;
        socket.send(`42["partyVersionUpdated", ${version}]`);
    });

    socket.on("setPartyGameMode", (gameMode) => {
        if (!gameMode) return socket.disconnect(true);
        if (typeof gameMode !== "string") return socket.disconnect(true);
        const partyKey = players[socket.id].partyKey;
        if (!partyKey) return;
        const party = parties[partyKey];
        if (!party) return;
        const partyPlayer = party.players.find((player) => player.id === socket.id);
        if (!partyPlayer?.leader) return;
        party.gameMode = gameMode;
        socket.send(`42["partyGameModeUpdated", ${gameMode}]`);
    });

    socket.on("setPartyRegion", (region) => {
        if (!region) return socket.disconnect(true);
        if (typeof region !== "string") return socket.disconnect(true);
        const partyKey = players[socket.id].partyKey;
        if (!partyKey) return;
        const party = parties[partyKey];
        if (!party) return;
        const partyPlayer = party.players.find((player) => player.id === socket.id);
        if (!partyPlayer?.leader) return;
        party.region = region;
        socket.send(`42["partyRegionUpdated", ${region}]`);
    });

    socket.on("setPartyAutofill", (autofill) => {
        if (autofill === undefined || autofill === null) return socket.disconnect(true);
        if (typeof autofill !== "boolean") return socket.disconnect(true);
        const partyKey = players[socket.id].partyKey;
        if (!partyKey) return;
        const party = parties[partyKey];
        if (!party) return;
        const partyPlayer = party.players.find((player) => player.id === socket.id);
        if (!partyPlayer?.leader) return;
        party.autofill = autofill;
        socket.send(`42["partyAutofillUpdated", ${autofill}]`);
    });

    socket.on("setIsInRound", (isInRound) => {
        const partyKey = players[socket.id].partyKey;
        if (partyKey) {
            const party = parties[partyKey];
            if (party && party.players) {
                players[socket.id].inRound = isInRound;
                const index = party.players.findIndex((player) => player.id === socket.id);
                party.players.at(index).inRound = isInRound;
                socket.send(`42["partyPlayerUpdated", ${JSON.stringify(party.players.at(index))}]`);
            }
        }
    });

    socket.on("restartPartyMatchmaking", () => {
        // Start matchmaking only if every player of the party is ready
        const isReady = players[socket.id].ready;
        if (isReady) {
            socket.send(`42["partyStateUpdated", "matchmaking"]`);
            console.log(gameServerDetails);
            socket.send(`42["partyJoinServer", ${gameServerDetails}]`);
            socket.send(`42["partyStateUpdated", "ingame"]`);
            socket.send(`42["partyStateUpdated", "waiting"]`);
        }
    });

    socket.on("setReady", (isReady) => {
        const partyKey = players[socket.id].partyKey;
        if (!partyKey) return;
        const party = parties[partyKey];
        if (!party) return;
        if (party && party.players) {
            players[socket.id].ready = isReady;
            const index = party.players.findIndex((player) => player.id === socket.id);
            party.players.at(index).ready = isReady;
            socket.send(`42["partyPlayerUpdated", ${JSON.stringify(party.players.at(index))}]`);
        }

        // Start matchmaking only if every player of the party is ready
        if (isReady) {
            socket.send(`42["partyStateUpdated", "matchmaking"]`);
            console.log(gameServerDetails);
            socket.send(`42["partyJoinServer", ${gameServerDetails}]`);
            socket.send(`42["partyStateUpdated", "ingame"]`);
            socket.send(`42["partyStateUpdated", "waiting"]`);
        }
    });

    socket.on("leaveParty", () => {
        const partyKey = players[socket.id].partyKey;
        if (partyKey) {
            const party = parties[partyKey];
            if (party && party.players) {
                const index = party.players.findIndex((player) => player.id === socket.id);
                if (index !== -1) {
                    party.players.splice(index, 1);
                    if (party.players.length === 0) {
                        delete parties[partyKey];
                    }
                    socket.send(`42["partyLeft"]`);
                }
            }
        }
    });

    socket.on("login", async (userKey) => {
        // Close socket, likely spamming
        if (players[socket.id].loginState === 1) return socket.disconnect(true);
        players[socket.id].loginState = 1;
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT id, name, avatar, email, friend_code, experience, level, coins, gems, status, updated, created " +
                "FROM users " +
                "WHERE id = (SELECT user_id FROM sessions WHERE `key` = ?)",
            [userKey]
        );
        if (players[socket.id] === null || players[socket.id] === undefined) return;
        // @ts-ignore
        if (rows.length === 0) {
            players[socket.id].loginState = 0;
            connection.release();
            return;
        }
        players[socket.id].loginState = 2;
        const user = rows[0];
        user.provider = "zrps";
        user.identifier = user.id.toString();
        players[socket.id].userData = user;
        socket.send(`42["loggedIn", ${JSON.stringify({ userData: user })}]`);
        socket.send(`42["clansData", ${JSON.stringify([])}]`);
        const [friendRequests] = await connection.execute(
            "SELECT u.friend_code, u.friend_code as name, u.avatar, f.created_at as sent " +
                "FROM friendreqs f " +
                "JOIN users u ON f.sender_id = u.id " +
                "WHERE f.receiver_id = ?",
            [user.id]
        );
        socket.send(`42["friendRequests", ${JSON.stringify(friendRequests)}]`);
        const [friends] = await connection.execute(
            "SELECT u.id, u.friend_code as name, u.avatar, u.updated, u.status " +
                "FROM friends f " +
                "JOIN users u ON (f.user_id = u.id AND f.friend_id = ?) OR (f.friend_id = u.id AND f.user_id = ?) " +
                "WHERE f.user_id = ? OR f.friend_id = ?",
            [user.id, user.id, user.id, user.id]
        );
        socket.send(`42["friendsData", ${JSON.stringify(friends)}]`);
        connection.release();
    });

    socket.on("logout", async () => {
        await clearUserStatus(socket.id);
        delete players[socket.id].userData;
        players[socket.id].loginState = 0;
    });

    socket.on("disconnect", async () => {
        console.log("A player has disconnected");
        const partyKey = players[socket.id].partyKey;
        if (partyKey) {
            const party = parties[partyKey];
            if (party && party.players) {
                const index = party.players.findIndex((player) => player.id === socket.id);
                if (index !== -1) {
                    party.players.splice(index, 1);
                    if (party.players.length === 0) {
                        delete parties[partyKey];
                    }
                }
            }
        }
        await clearUserStatus(socket.id);
        delete players[socket.id];
    });

    // Handle errors
    socket.on("error", (err) => {
        console.error("Client socket error:", err);
        socket.close();
    });

    // Log disconnections
    socket.on("close", () => {
        console.log("Client disconnected");
    });
});

async function clearUserStatus(socketId) {
    if (players[socketId].loginState !== 2) return;
    const userId = players[socketId].userData.id;
    const friendCode = players[socketId].userData.friend_code;
    const connection = await pool.getConnection();
    connection.execute("UPDATE users " + "SET status = ?, updated = NOW() " + "WHERE id = ?", ["offline", userId]);
    // Notify friends
    const [friendIds] = await connection.execute(
        "SELECT u.id " +
            "FROM friends f " +
            "JOIN users u ON (f.user_id = u.id AND f.friend_id = ?) OR (f.friend_id = u.id AND f.user_id = ?) " +
            "WHERE f.user_id = ? OR f.friend_id = ?",
        [userId, userId, userId, userId]
    );
    const [updatedFriend] = await connection.execute(
        "SELECT u.id, u.friend_code, u.friend_code as name, u.avatar, u.updated, u.status " +
            "FROM friends f " +
            "JOIN users u ON u.friend_code = ? " +
            "WHERE f.user_id = ? OR f.friend_id = ? " +
            "LIMIT 1",
        [friendCode, userId, userId]
    );
    // @ts-ignore
    if (updatedFriend.length === 0) return connection.release();
    const playersById = {};
    Object.values(players).forEach((player) => {
        playersById[player.userData?.id] = player;
    });
    // @ts-ignore
    friendIds.forEach((friend) => {
        const player = playersById[friend.id];
        if (player) {
            player.socket.send(`42["friendUpdated", ${JSON.stringify(updatedFriend[0])}]`);
        }
    });
    connection.release();
}
