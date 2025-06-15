// Import the necessary modules
import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { WebSocketServer } from "ws";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { Codec, PacketId, BinaryReader, BinaryWriter } from "zombslib";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Create an HTTP server
const serverOptions = {
    key: readFileSync("privatekey.pem"),
    cert: readFileSync("certificate.pem"),
};
const server = https.createServer(serverOptions);

// Create a WSS server
const wss = new WebSocketServer({ server: server });
wss.on("connection", (ws, req) => {
    const endpoint = req.url.slice(1);
    console.log("Client connected");

    let codec = new Codec("../../rpcs/Windows-Rpcs.json");
    let currentTick = 0;
    let firing = false;
    const tickRate = 64;
    // ~15.625 ms
    const tickInterval = 1000 / tickRate;

    ws.on("message", async (message) => {
        var payload = new Uint8Array(message);
        switch (payload[0]) {
            case PacketId.EntityUpdate: {
                console.log("Incoming PACKET_ENTITY_UPDATE:", payload);
                break;
            }
            case PacketId.PlayerCounterUpdate: {
                console.log("Incoming PACKET_PLAYER_COUNTER_UPDATE:", payload);
                break;
            }
            case PacketId.SetWorldDimensions: {
                console.log("Incoming PACKET_SET_WORLD_DIMENSIONS:", payload);
                break;
            }
            case PacketId.Input: {
                console.log("Incoming PACKET_INPUT:", payload);
                break;
            }
            case PacketId.EnterWorld: {
                console.log("Incoming PACKET_ENTER_WORLD:", payload);
                const enterWorldRequest =
                    codec.decodeEnterWorldRequest(payload);
                const powResult = codec.validateProofOfWork(
                    enterWorldRequest.proofOfWork,
                    endpoint
                );
                if (!powResult.valid) {
                    ws.close();
                    return;
                }
                const platform = powResult.platform;
                console.log(platform);
                codec = new Codec(`../../rpcs/${platform}-Rpcs.json`);
                const enterWorldResponse = {
                    version: codec.rpcMapping.Codec,
                    allowed: 1,
                    uid: 338,
                    startingTick: 10,
                    tickRate: tickRate,
                    effectiveTickRate: tickRate,
                    players: 0,
                    maxPlayers: 200,
                    chatChannel: 0,
                    effectiveDisplayName: enterWorldRequest.displayName,
                    x1: 0,
                    y1: 0,
                    x2: 20000,
                    y2: 20000,
                    entities: [],
                    rpcs: [],
                    mode: "PrivateSolo",
                    map: "Map1",
                    udpCookie: 0,
                    udpPort: 9000,
                };
                enterWorldResponse.entities = JSON.parse(
                    `[{"id":249036071,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":910088174,"type":10},{"nameHash":2460616447,"type":1},{"nameHash":3940594818,"type":1},{"nameHash":3886551347,"type":10},{"nameHash":471584441,"type":10},{"nameHash":1506661530,"type":10},{"nameHash":1953535413,"type":3}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":249036071,"isOnFire":0,"firingTick":0,"deathTick":0,"A_0xe7a81133":0,"dataIndex":0,"equippedDataIndex":0,"A_0x747095b5":0}},{"id":504903628,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":9},{"nameHash":3940594818,"type":1},{"nameHash":2201028498,"type":1},{"nameHash":2549878347,"type":1},{"nameHash":1574999092,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":3970592772,"dataIndex":0,"deathTick":0,"airDropLandTick":0,"creationTick":0,"sprayIndex":0}},{"id":580082061,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":620904617,"type":1},{"nameHash":1233076658,"type":10},{"nameHash":3128833283,"type":10}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":580082061,"A_0x250240a9":0,"A_0x497f41b2":0,"A_0xba7e3503":0}},{"id":1112845922,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":2232061803,"type":3},{"nameHash":3411739057,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":3965757274,"type":4},{"nameHash":396231043,"type":11},{"nameHash":2065533638,"type":11},{"nameHash":3037433226,"type":1},{"nameHash":3940594818,"type":1},{"nameHash":2460616447,"type":1},{"nameHash":2883383757,"type":1},{"nameHash":1205522264,"type":3},{"nameHash":1767079171,"type":3},{"nameHash":129999719,"type":10},{"nameHash":1506661530,"type":10},{"nameHash":3284448976,"type":10},{"nameHash":2076321484,"type":10},{"nameHash":1364116198,"type":9},{"nameHash":2391951737,"type":1},{"nameHash":3013078650,"type":1},{"nameHash":9937773,"type":3},{"nameHash":3707014400,"type":3},{"nameHash":1161135437,"type":10},{"nameHash":1804627392,"type":10},{"nameHash":3044274584,"type":3},{"nameHash":4223951838,"type":3},{"nameHash":1312790758,"type":3},{"nameHash":4117515090,"type":3},{"nameHash":3527174458,"type":3},{"nameHash":752369509,"type":3},{"nameHash":485783130,"type":8},{"nameHash":1657309942,"type":1},{"nameHash":4095913789,"type":1},{"nameHash":2096278210,"type":8},{"nameHash":3257708849,"type":8},{"nameHash":1987892684,"type":1},{"nameHash":2426740830,"type":3},{"nameHash":34162050,"type":10},{"nameHash":4081874656,"type":10},{"nameHash":3239833222,"type":1},{"nameHash":570200045,"type":9},{"nameHash":957099820,"type":9},{"nameHash":2516899740,"type":3},{"nameHash":2948797259,"type":1},{"nameHash":1918570631,"type":10},{"nameHash":1325424963,"type":1},{"nameHash":2666157490,"type":9},{"nameHash":1803613228,"type":10},{"nameHash":2950326362,"type":1},{"nameHash":1859733209,"type":1},{"nameHash":1553612668,"type":10},{"nameHash":918024898,"type":3},{"nameHash":3724070810,"type":3},{"nameHash":2650249996,"type":9},{"nameHash":910088174,"type":10},{"nameHash":4223896640,"type":9},{"nameHash":4272078913,"type":1},{"nameHash":728513717,"type":10},{"nameHash":3992104816,"type":10},{"nameHash":1349887677,"type":10},{"nameHash":139502709,"type":10},{"nameHash":733149254,"type":10},{"nameHash":1445646640,"type":10},{"nameHash":1004238105,"type":10},{"nameHash":307704207,"type":10},{"nameHash":2724486410,"type":1},{"nameHash":1606526932,"type":10},{"nameHash":2307640448,"type":1},{"nameHash":2256189882,"type":1},{"nameHash":3980301664,"type":10},{"nameHash":2653271241,"type":5},{"nameHash":1779994739,"type":10},{"nameHash":3115359844,"type":10},{"nameHash":3821095497,"type":9},{"nameHash":444524105,"type":10},{"nameHash":3740327455,"type":1},{"nameHash":2173100889,"type":10},{"nameHash":3076225077,"type":12},{"nameHash":4209796065,"type":11},{"nameHash":1775539923,"type":1},{"nameHash":1184607771,"type":10},{"nameHash":2034799789,"type":10},{"nameHash":4154619706,"type":3},{"nameHash":375515437,"type":10},{"nameHash":3924316727,"type":1},{"nameHash":2502024226,"type":1},{"nameHash":529838746,"type":10},{"nameHash":4232709862,"type":9},{"nameHash":1854863057,"type":3},{"nameHash":1953535413,"type":3},{"nameHash":3639531273,"type":8},{"nameHash":1902856499,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Health":0,"MaxHealth":100,"Dead":0,"ModelHash":1112845922,"Name":"Player","AimingYaw":0,"Kills":0,"A_0xb50b8d8a":0,"deathTick":0,"firingTick":0,"lastDamagedTick":0,"currentAmmo":0,"maxAmmo":0,"equippedCategoryId":0,"equippedDataIndex":0,"equippedTier":0,"equippedInventorySlot":0,"equippedSkinId":0,"actionStartedTick":0,"actionEndsTick":0,"healthDamageTaken":1000,"shieldDamageTaken":1000,"A_0x4535854d":0,"effect":255,"shield":0,"maxShield":0,"smallAmmo":0,"mediumAmmo":0,"largeAmmo":0,"shotgunAmmo":0,"visibleBuildingUids":[],"reloadStartedTick":0,"reloadEndsTick":0,"interactableUids":[],"obtainableUids":[],"parachuteStartedTick":0,"parachuteMsRemaining":0,"isFreefalling":0,"canParachute":0,"emoteTick":0,"parachuteId":0,"bodyId":0,"wood":0,"spectatingUid":0,"spectateCount":0,"firingSequence":0,"partyId":0,"partyColor":0,"reviveStartedTick":0,"reviveEndsTick":0,"isKnockedDown":0,"knockedDownHealth":0,"knockedDownMaxHealth":0,"knockDowns":0,"isOnFire":0,"zombieKills":0,"startChargingTick":0,"isInBuildingMode":0,"A_0xedf2af70":0,"movementSpeedAffinityRocks":0,"defenseAffinityRocks":0,"bulletDamageAffinityRocks":0,"bulletSpeedAffinityRocks":0,"isInWater":0,"A_0x1257318f":0,"backpackId":0,"A_0x5fc1a7d4":0,"A_0x898bcc80":0,"portalEnterTick":0,"isPoisoned":0,"grapplingHookPosition":{"x":0,"y":0},"isGrappling":0,"isVip":0,"emoteIndex2":0,"isBoosted":0,"startChargeUpTick":0,"isSlowed":0,"lastBulletLifetimePercent":0,"lastBulletDataIndex":-1,"vehicleUid":0,"vehicleSlot":0,"equippedModifierIndex":0,"A_0xf7a2773a":0,"A_0x1661e92d":0,"A_0xe9e85237":0,"A_0x9521dc22":0,"A_0x1f94b29a":0,"A_0xfc4a06e6":0,"cockingMsRemaining":0,"A_0x747095b5":0,"A_0xd8eed709":[],"A_0x716b4933":0}},{"id":1491795389,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":9},{"nameHash":3940594818,"type":1},{"nameHash":2201028498,"type":1},{"nameHash":3411739057,"type":3},{"nameHash":2666157490,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":3970592772,"dataIndex":0,"deathTick":0,"airDropLandTick":0,"MaxHealth":0,"partyId":0}},{"id":1561019755,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":10},{"nameHash":3940594818,"type":1},{"nameHash":791445081,"type":8},{"nameHash":1124791699,"type":10}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":3970592772,"dataIndex":0,"deathTick":0,"vehicleOccupants":[],"A_0x430af593":1}},{"id":2383969827,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":3411739057,"type":3},{"nameHash":1899079302,"type":4},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"MaxHealth":0,"EntityClass":"PhysicsEntity","Dead":0,"ModelHash":3647459127}},{"id":2414203739,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":3370100680,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"ModelHash":2414203739}},{"id":2817316692,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":9},{"nameHash":3540988168,"type":10},{"nameHash":1205522264,"type":3},{"nameHash":124913137,"type":10},{"nameHash":3451747963,"type":1},{"nameHash":3866926138,"type":9},{"nameHash":2240057735,"type":9},{"nameHash":3707506636,"type":10},{"nameHash":2900975594,"type":10}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"ModelHash":2817316692,"dataIndex":0,"categoryId":0,"currentAmmo":0,"tier":0,"A_0xcdbd7e7b":0,"quantity":0,"skinId":0,"modifierIndex":0,"weaponKills":0}},{"id":3067001770,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":3370100680,"type":1},{"nameHash":3940594818,"type":1},{"nameHash":471584441,"type":10},{"nameHash":441901997,"type":1},{"nameHash":2729366668,"type":1},{"nameHash":3886314514,"type":10},{"nameHash":3423242791,"type":10},{"nameHash":124913137,"type":10},{"nameHash":2549878347,"type":1},{"nameHash":733149254,"type":10},{"nameHash":1445646640,"type":10},{"nameHash":2477343565,"type":3},{"nameHash":2089316765,"type":1},{"nameHash":2636873287,"type":9},{"nameHash":3707506636,"type":10},{"nameHash":1124457266,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"ModelHash":3067001770,"deathTick":0,"dataIndex":0,"collisionUid":0,"ownerUid":0,"trailId":0,"trailColorId":0,"tier":0,"creationTick":0,"bulletDamageAffinityRocks":0,"bulletSpeedAffinityRocks":0,"A_0x93a9434d":1,"stuckAtTick":0,"effectiveLifetimeMs":0,"modifierIndex":0,"A_0x4305db32":0}},{"id":3750051221,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":10},{"nameHash":1489880305,"type":17},{"nameHash":956693851,"type":17},{"nameHash":2730579844,"type":17}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":3750051221,"dataIndex":0,"openDoorIds":[],"openDoorDirections":[],"brokenWindowIds":[]}},{"id":3970592772,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":9},{"nameHash":3940594818,"type":1},{"nameHash":2201028498,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":3970592772,"dataIndex":0,"deathTick":0,"airDropLandTick":0}},{"id":4049394616,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":3370100680,"type":1},{"nameHash":145240268,"type":3},{"nameHash":3318715651,"type":5},{"nameHash":1245424964,"type":3},{"nameHash":3095156091,"type":5},{"nameHash":2941477767,"type":3},{"nameHash":3256293950,"type":5},{"nameHash":471584441,"type":2},{"nameHash":291542999,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"ModelHash":4049394616,"currentCircleRadius":0,"currentCirclePosition":{"x":0,"y":0},"nextCircleRadius":0,"nextCirclePosition":{"x":0,"y":0},"lastCircleRadius":0,"lastCirclePosition":{"x":0,"y":0},"dataIndex":0,"currentCircleTick":0}},{"id":4108209120,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":10},{"nameHash":3940594818,"type":1}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":4108209120,"dataIndex":0,"deathTick":0}},{"id":4124010558,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":910088174,"type":10},{"nameHash":2460616447,"type":1},{"nameHash":3940594818,"type":1},{"nameHash":3886551347,"type":10},{"nameHash":471584441,"type":10},{"nameHash":1506661530,"type":10},{"nameHash":129999719,"type":10},{"nameHash":1657309942,"type":1},{"nameHash":4095913789,"type":1},{"nameHash":4272078913,"type":1},{"nameHash":396231043,"type":9}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"Dead":0,"ModelHash":1112845922,"isOnFire":0,"firingTick":0,"deathTick":0,"A_0xe7a81133":0,"dataIndex":0,"equippedDataIndex":0,"equippedCategoryId":0,"reloadStartedTick":0,"reloadEndsTick":0,"startChargingTick":0,"AimingYaw":0}},{"id":4131010518,"attributes":[{"nameHash":2045070744,"type":5},{"nameHash":338163296,"type":3},{"nameHash":2232061803,"type":3},{"nameHash":3411739057,"type":3},{"nameHash":1899079302,"type":4},{"nameHash":487111411,"type":10},{"nameHash":3370100680,"type":1},{"nameHash":471584441,"type":9}],"sortedUids":[],"defaultTick":{"Position":{"x":0,"y":0},"Yaw":0,"Health":0,"MaxHealth":0,"EntityClass":"GamePlayerBuilding","Dead":0,"ModelHash":4131010518,"dataIndex":0}}]`
                );
                codec.entityMaps = enterWorldResponse.entities;
                enterWorldResponse.rpcs = [];
                for (let i = 0; i < codec.rpcMapping.Rpcs.length; ++i) {
                    let rpc = {};
                    rpc.index = i;
                    rpc.nameHash = codec.rpcMapping.Rpcs[i].NameHash;

                    const parameterCount =
                        codec.rpcMapping.Rpcs[i].Parameters.length;
                    rpc.isArray = codec.rpcMapping.Rpcs[i].IsArray;
                    rpc.parameters = [];
                    for (let j = 0; j < parameterCount; ++j) {
                        let rpcParameter = {};
                        rpcParameter.nameHash =
                            codec.rpcMapping.Rpcs[i].Parameters[j].NameHash;
                        rpcParameter.type =
                            codec.rpcMapping.Rpcs[i].Parameters[j].Type;
                        rpcParameter.internalIndex = -1;
                        rpc.parameters.push(rpcParameter);
                    }

                    enterWorldResponse.rpcs.push(rpc);
                }
                codec.enterWorldResponse = enterWorldResponse;
                ws.send(codec.encodeEnterWorldResponse(enterWorldResponse));
                codec.computeRpcKey(
                    enterWorldRequest.version,
                    new TextEncoder().encode("/" + endpoint),
                    enterWorldRequest.proofOfWork
                );
                /*
                writeFileSync(
                    "enterWorldResponse.json",
                    JSON.stringify(codec.enterWorldResponse, null, 2)
                );
                */
                break;
            }
            case PacketId.Ping: {
                console.log("Incoming PACKET_PING:", payload);
                const reader = new BinaryReader(payload, 2);
                if (reader.canRead(3)) {
                    const requestSentTick = reader.readUint32();
                    const responseSentTick = currentTick;
                    const writer = new BinaryWriter(0);
                    writer.writeUint8(PacketId.Ping);
                    writer.writeUint32(requestSentTick);
                    writer.writeUint32(responseSentTick);
                    ws.send(writer.toArray());
                    console.log(writer.toArray());
                } else {
                    ws.send([7, 0]);
                }
                break;
            }
            case PacketId.Rpc: {
                // console.log("Incoming PACKET_RPC:", payload);
                const decrypedData = codec.cryptRpc(payload);

                const definition = codec.enterWorldResponse.rpcs.find(
                    (rpc) => rpc.index === decrypedData[1]
                );

                const rpc = codec.decodeRpc(definition, decrypedData);

                if (rpc !== undefined && rpc.name !== null) {
                    console.log(rpc.name, rpc.data);

                    switch (rpc.name) {
                        case "SetPlatformRpc": {
                            const schemasDir = path.join(__dirname, "schemas");
                            for (const file of await fs.readdir(schemasDir)) {
                                if (path.extname(file) === ".json") {
                                    const name = path.parse(file).name;
                                    const data = await fs.readFile(
                                        path.join(schemasDir, file),
                                        "utf-8"
                                    );
                                    ws.send(
                                        codec.encodeRpc("CompressedDataRpc", {
                                            dataName: name,
                                            json: data,
                                        })
                                    );
                                }
                            }
                            /*
                            ws.send(
                                codec.encodeRpc("GameStatusRpc", {
                                    status: "Lobby",
                                    countDownEndsTick: 0,
                                })
                            );
                            */
                            ws.send(
                                codec.encodeRpc("GameStatusRpc", {
                                    status: "Game",
                                    countDownEndsTick: 0,
                                })
                            );
                            ws.send(codec.encodeRpc("DataFinishedRpc", {}));
                            ws.send(
                                codec.encodeRpc("InventoryUpdateRpc", {
                                    modifierIndex: 0,
                                    inventorySlot: 0,
                                    skinId: 0,
                                    categoryId: 1,
                                    dataIndex: 0,
                                    stacks: 3,
                                    tier: 0,
                                })
                            );
                            ws.send(
                                codec.encodeRpc("InventoryUpdateEquipRpc", {
                                    inventorySlot: 0,
                                })
                            );
                            ws.send(
                                codec.encodeRpc("PlayerCountRpc", {
                                    team1Alive: 0,
                                    partiesAlive: 999,
                                    team2Alive: 0,
                                    playersAlive: 999,
                                    totalParties: 999,
                                    totalPlayers: 999,
                                })
                            );
                            break;
                        }
                        case "StartTcpStreamRpc": {
                            const updateData = readFileSync("update.bin");
                            const lastUpdate = codec.decodeEntityUpdate(
                                new Uint8Array(updateData)
                            );
                            ws.send(updateData);
                            currentTick = lastUpdate.tick;

                            (async () => {
                                while (true) {
                                    // Send tick update
                                    ws.send(
                                        codec.encodeEntityUpdate({
                                            createdEntities: [],
                                            tick: ++currentTick,
                                            deletedEntities: [],
                                        })
                                    );

                                    // console.log(currentTick);

                                    // Wait for next tick
                                    await sleep(tickInterval);
                                }
                            })();
                            break;
                        }
                        case "SendChatMessageRpc": {
                            ws.send(
                                codec.encodeRpc("ReceiveChatMessageRpc", {
                                    displayName:
                                        codec.enterWorldResponse
                                            .effectiveDisplayName,
                                    channel: rpc.data.channel,
                                    message: rpc.data.message,
                                    uid: codec.enterWorldResponse.uid,
                                })
                            );
                            switch (rpc.data.message) {
                                case "/hack": {
                                    const player = codec.entityList.get(
                                        codec.enterWorldResponse.uid
                                    );
                                    if (!player) return;
                                    player.tick.isOnFire = true;
                                    player.tick.isPoisoned = true;
                                    player.tick.effect = true;
                                    player.tick.wood = 999999;
                                    player.tick.smallAmmo = 9999;
                                    player.tick.mediumAmmo = 9999;
                                    player.tick.largeAmmo = 9999;
                                    player.tick.shotgunAmmo = 9999;
                                    player.tick.shield = 12157520;
                                    player.tick.maxShield = 12157520;
                                    player.tick.Health = 12157520;
                                    player.tick.MaxHealth = 12157520;
                                    break;
                                }
                            }
                            break;
                        }
                        case "EquipItemRpc": {
                            ws.send(
                                codec.encodeRpc(
                                    "InventoryUpdateEquipRpc",
                                    rpc.data
                                )
                            );
                            break;
                        }
                        case "SetLoadoutRpc": {
                            ws.send(
                                codec.encodeRpc("SetClientLoadoutRpc", rpc.data)
                            );
                            break;
                        }
                        case "ParachuteRpc": {
                            ws.send(
                                codec.encodeRpc("GameStatusRpc", {
                                    status: "Parachute",
                                    countDownEndsTick: 0,
                                })
                            );
                            break;
                        }
                        case "SetMarkerRpc": {
                            ws.send(
                                codec.encodeRpc("UpdateMarkerRpc", {
                                    valid: rpc.data.valid,
                                    uid: codec.encodeEnterWorldResponse.uid,
                                    x: rpc.data.x * 100,
                                    y: rpc.data.y * 100,
                                })
                            );
                            break;
                        }
                        case "LoginRpc": {
                            ws.send(
                                codec.encodeRpc("AccountSessionRpc", {
                                    json: "{}",
                                })
                            );
                        }
                        case "SetSkinRpc": {
                            const player = codec.entityList.get(
                                codec.enterWorldResponse.uid
                            );
                            if (!player) return;
                            player.tick.skinId = rpc.data.skinId;
                            break;
                        }
                        case "SetEmoteRpc": {
                            const player = codec.entityList.get(
                                codec.enterWorldResponse.uid
                            );
                            if (!player) return;
                            player.tick.emoteIndex2 = rpc.data.emote2;
                            player.tick.emoteTick = currentTick;
                            break;
                        }
                        case "InputRpc": {
                            const player = codec.entityList.get(
                                codec.enterWorldResponse.uid
                            );
                            if (!player) return;

                            (async () => {
                                if (firing = true) return;
                                if (
                                    rpc.data.mouseUp === -1 &&
                                    rpc.data.mouseDown !== -1
                                ) {
                                    firing = true;
                                    player.tick.firingTick = currentTick;
                                    player.tick.firingSequence++;
                                }
                                await sleep(tickInterval * 64);
                                firing = false;
                            })();

                            // Create direction vector
                            let dx = 0;
                            let dy = 0;

                            const speed = 5;

                            // Use angle-based movement if moveDirection is valid
                            if (
                                typeof rpc.data.moveDirection === "number" &&
                                rpc.data.moveDirection >= 0 &&
                                rpc.data.moveDirection < 360
                            ) {
                                // Convert angle to radians (0° = up, clockwise is positive)
                                const radians =
                                    rpc.data.moveDirection * (Math.PI / 180);
                                dx = Math.sin(radians) * speed;
                                dy = Math.cos(radians) * speed; // No negative, Y increases upward
                            } else {
                                // Use WASD-like movement
                                if (rpc.data.up === 1) dy += 1;
                                if (rpc.data.down === 1) dy -= 1;
                                if (rpc.data.left === 1) dx -= 1;
                                if (rpc.data.right === 1) dx += 1;

                                // Normalize movement
                                if (dx !== 0 || dy !== 0) {
                                    const length = Math.sqrt(dx * dx + dy * dy);
                                    dx = (dx / length) * speed;
                                    dy = (dy / length) * speed;
                                }
                            }

                            // Apply movement
                            if (dx !== 0 || dy !== 0) {
                                player.tick.Position.x += dx;
                                player.tick.Position.y += dy;
                            }

                            break;
                        }
                    }
                }
                break;
            }
            case PacketId.UdpConnect: {
                console.log("Incoming PACKET_UDP_CONNECT:", payload);
                break;
            }
            case PacketId.UdpTick: {
                console.log("Incoming PACKET_UDP_TICK:", payload);
                break;
            }
            case PacketId.UdpAckTick: {
                console.log("Incoming PACKET_UDP_ACK_TICK:", payload);
                break;
            }
            case PacketId.UdpPong: {
                console.log("Incoming PACKET_UDP_PONG:", payload);
                break;
            }
            case PacketId.UdpPingWithCompressedUids: {
                console.log(
                    "Incoming PACKET_UDP_TICK_WITH_COMPRESSED_UIDS:",
                    payload
                );
                break;
            }
            case PacketId.UdpFragment: {
                console.log("Incoming PACKET_UDP_FRAGMENT:", payload);
                break;
            }
            case PacketId.UdpConnect1300: {
                console.log("Incoming PACKET_UDP_CONNECT_1300:", payload);
                break;
            }
            case PacketId.UdpConnect500: {
                console.log("Incoming PACKET_UDP_CONNECT_500:", payload);
                break;
            }
            case PacketId.UdpRpc: {
                console.log("Incoming PACKET_UDP_RPC:", payload);
                break;
            }
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// Start the server
server.listen(
    parseInt(process.env.PORT || "3003"),
    process.env.HOST || "localhost",
    () => {
        console.log(
            `[${
                process.env.SERVER_NAME || "ZRPS"
            }] Ingame is now listening on port ${process.env.PORT || "3003"}`
        );
    }
);
