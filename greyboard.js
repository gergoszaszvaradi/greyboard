"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreyBoard = exports.GBBuffer = void 0;
const socket_io_1 = __importDefault(require("socket.io"));
const fs_1 = __importDefault(require("fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const nicknames_js_1 = __importDefault(require("./nicknames.js"));
class GBBuffer {
    constructor(size = 0) {
        this.buffer = Buffer.allocUnsafe(size);
        this.offset = 0;
    }
    static fromBuffer(b) {
        let gbBuffer = new GBBuffer();
        gbBuffer.buffer = b;
        return gbBuffer;
    }
    writeUChar(v) { this.offset = this.buffer.writeUInt8(v, this.offset); }
    readUChar() { this.offset += 1; return this.buffer.readUInt8(this.offset - 1); }
    writeUInt(v) { this.offset = this.buffer.writeUInt32BE(v, this.offset); }
    readUInt() { this.offset += 4; return this.buffer.readUInt32BE(this.offset - 4); }
    writeFloat(v) { this.offset = this.buffer.writeFloatBE(v, this.offset); }
    readFloat() { this.offset += 4; return this.buffer.readFloatBE(this.offset - 4); }
    writeString(str) {
        for (let c of str) {
            this.offset = this.buffer.writeUInt8(c.charCodeAt(0), this.offset);
        }
        this.offset = this.buffer.writeUInt8(0, this.offset);
    }
    readString() {
        let str = "";
        while (true) {
            let c = this.buffer.readUInt8(this.offset);
            this.offset++;
            if (c == 0)
                break;
            str += String.fromCharCode(c);
        }
        return str;
    }
}
exports.GBBuffer = GBBuffer;
class GreyBoard {
    constructor(server) {
        this.loadedBoards = {};
        this.createDebugBoard();
        this.io = socket_io_1.default.listen(server);
        this.io.on("connection", (socket) => {
            console.log(`Socket ${socket.id} connected.`);
            let bid = "";
            socket.on("connected", (data) => {
                if (!this.boardExists(data.data.bid)) {
                    socket.disconnect(true);
                    return;
                }
                for (let room in socket.rooms)
                    if (socket.id !== room)
                        socket.leave(room);
                bid = data.data.bid;
                let board = this.loadedBoards[bid];
                if (board) {
                    socket.join(bid);
                    if (data.data.name == null)
                        data.data.name = nicknames_js_1.default();
                    board.clients[socket.id] = data.data;
                    socket.emit("room:state", board);
                    socket.broadcast.to(bid).emit("client:connect", data.data);
                }
            });
            socket.on("disconnect", () => {
                console.log(`Socket ${socket.id} disconnected.`);
                let board = this.loadedBoards[bid];
                if (board) {
                    delete board.clients[socket.id];
                    this.io.to(bid).emit("client:disconnect", socket.id);
                }
            });
            socket.on("client:update", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    let client = board.clients[data.cid];
                    if (client) {
                        client.x = data.data.x;
                        client.y = data.data.y;
                    }
                }
            });
            socket.on("client:afk", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    let client = board.clients[data.cid];
                    if (client) {
                        client.afk = data.data;
                    }
                }
            });
            socket.on("board:name", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    board.name = data.data;
                    socket.broadcast.to(bid).emit("board:name", data.data);
                }
            });
            socket.on("board:add", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    for (let i of data.data) {
                        board.items[i.id] = i;
                    }
                    socket.broadcast.to(bid).emit("board:add", data.data);
                }
            });
            socket.on("board:move", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    for (let id of data.data.ids) {
                        let item = board.items[id];
                        if (item) {
                            item.rect.x -= data.data.dx;
                            item.rect.y -= data.data.dy;
                        }
                    }
                    socket.broadcast.to(bid).emit("board:move", data.data);
                }
            });
            socket.on("board:scale", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    let bb = { x: Infinity, y: Infinity, w: -Infinity, h: -Infinity };
                    for (let id of data.data.ids) {
                        let item = board.items[id];
                        if (item) {
                            if (item.rect.x < bb.x)
                                bb.x = item.rect.x;
                            if (item.rect.x + item.rect.w > bb.w)
                                bb.w = item.rect.x + item.rect.w;
                            if (item.rect.y < bb.y)
                                bb.y = item.rect.y;
                            if (item.rect.y + item.rect.h > bb.h)
                                bb.h = item.rect.y + item.rect.h;
                        }
                    }
                    bb.w -= bb.x;
                    bb.h -= bb.y;
                    for (let id of data.data.ids) {
                        let item = board.items[id];
                        if (item) {
                            item.rect.x -= ((item.rect.x - bb.x) / bb.w) * data.data.dx;
                            item.rect.y -= ((item.rect.y - bb.y) / bb.h) * data.data.dy;
                            item.rect.w -= (item.rect.w / bb.w) * data.data.dx;
                            item.rect.h -= (item.rect.h / bb.h) * data.data.dy;
                        }
                    }
                    socket.broadcast.to(bid).emit("board:scale", data.data);
                }
            });
            socket.on("board:remove", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    for (let id of data.data)
                        delete board.items[id];
                    socket.broadcast.to(bid).emit("board:remove", data.data);
                }
            });
            socket.on("board:clear", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    for (let id in board.items)
                        delete board.items[id];
                    socket.broadcast.to(bid).emit("board:clear", data.data);
                }
            });
            socket.on("board:visibility", (data) => {
                let board = this.loadedBoards[bid];
                if (board) {
                    board.public = data.data;
                    socket.broadcast.to(bid).emit("board:visibility", data.data);
                }
            });
        });
        this.hearthbeat();
        this.keepHostAlive();
    }
    createBoard(id) {
        if (id == undefined)
            id = this.generateID();
        this.loadedBoards[id] = {
            id: id,
            name: "New board",
            items: {},
            clients: {},
            public: false
        };
        return id;
    }
    createDebugBoard() {
        this.createBoard("0000000000000000");
    }
    boardExists(id) {
        return id in this.loadedBoards;
    }
    getPublicBoards() {
        let boards = new Array();
        for (let id in this.loadedBoards)
            if (this.loadedBoards[id].public)
                boards.push(this.loadedBoards[id]);
        return boards;
    }
    generateID() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let id = "";
        for (let i = 0; i < 16; i++)
            id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }
    validateID(id) {
        return id.match(/^[A-z0-9]{16}$/) != null;
    }
    hearthbeat() {
        for (let id in this.loadedBoards)
            this.io.to(id).emit("client:state", this.loadedBoards[id].clients);
        setTimeout(() => { this.hearthbeat(); }, 100);
    }
    keepHostAlive() {
        setTimeout(() => {
            if (Object.keys(this.io.sockets.connected).length > 0) {
                node_fetch_1.default("https://greyboard.herokuapp.com/", { method: "get" }).then((res) => console.log("Keeping alive!"));
            }
            else {
                console.log("No connections on the server, shutting down...");
            }
            this.keepHostAlive();
        }, 1200000);
    }
    writeToResponse(res, bid) {
        if (!(bid in this.loadedBoards))
            return;
        let board = this.loadedBoards[bid];
        let size = 4;
        let count = 0;
        for (let i in board.items) {
            let item = board.items[i];
            size += 1 + 4 * 4;
            if (item.type == 1) {
                size += 3 + 1 + 4 + item.points.length * 2 * 4;
            }
            else if (item.type == 2 || item.type == 3) {
                size += 3 + 1 + 1;
            }
            else if (item.type == 4) {
                size += 3 + 1 + 8 + 8;
            }
            else if (item.type == 5) {
                size += Buffer.byteLength(item.src) + 1;
            }
            else if (item.type == 6) {
                size += Buffer.byteLength(item.text) + 1 + 3;
            }
            count++;
        }
        let hexToRgb = function (hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        let buffer = new GBBuffer(size);
        buffer.writeUInt(count);
        for (let i in board.items) {
            let item = board.items[i];
            buffer.writeUChar(item.type);
            buffer.writeFloat(item.rect.x);
            buffer.writeFloat(item.rect.y);
            buffer.writeFloat(item.rect.w);
            buffer.writeFloat(item.rect.h);
            if (item.type == 1) {
                let color = hexToRgb(item.color);
                if (color == null)
                    continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeUInt(item.points.length);
                for (let point of item.points) {
                    buffer.writeFloat(point.x);
                    buffer.writeFloat(point.y);
                }
            }
            else if (item.type == 2 || item.type == 3) {
                let color = hexToRgb(item.color);
                if (color == null)
                    continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeUChar(item.filled);
            }
            else if (item.type == 4) {
                let color = hexToRgb(item.color);
                if (color == null)
                    continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeFloat(item.start.x);
                buffer.writeFloat(item.start.y);
                buffer.writeFloat(item.end.x);
                buffer.writeFloat(item.end.y);
            }
            else if (item.type == 5) {
                buffer.writeString(item.src);
            }
            else if (item.type == 6) {
                let color = hexToRgb(item.color);
                if (color == null)
                    continue;
                buffer.writeString(item.text);
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
            }
        }
        res.write(buffer.buffer);
    }
    loadFromFile(path, callback) {
        fs_1.default.readFile(path, (err, buffer) => {
            if (err) {
                callback(new Error(err.message), "");
                return;
            }
            try {
                let gbBuffer = GBBuffer.fromBuffer(buffer);
                let bid = this.createBoard();
                let board = this.loadedBoards[bid];
                this.loadedBoards[bid].name = "Loaded board";
                let count = gbBuffer.readUInt();
                let rgbToHex = function (r, g, b) {
                    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                };
                for (let i = 0; i < count; i++) {
                    let item = null;
                    let type = gbBuffer.readUChar();
                    if (type == 1) {
                        item = {
                            id: this.generateID(),
                            cid: "unknown",
                            type,
                            rect: {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat(),
                                w: gbBuffer.readFloat(),
                                h: gbBuffer.readFloat()
                            },
                            color: "",
                            weight: 0,
                            points: new Array()
                        };
                        item.color = rgbToHex(gbBuffer.readUChar(), gbBuffer.readUChar(), gbBuffer.readUChar());
                        item.weight = gbBuffer.readUChar();
                        let pointCount = gbBuffer.readUInt();
                        for (let j = 0; j < pointCount; j++) {
                            let point = {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat()
                            };
                            item.points.push(point);
                        }
                    }
                    else if (type == 2 || type == 3) {
                        item = {
                            id: this.generateID(),
                            cid: "unknown",
                            type,
                            rect: {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat(),
                                w: gbBuffer.readFloat(),
                                h: gbBuffer.readFloat()
                            },
                            color: "",
                            weight: 0,
                            filled: false
                        };
                        item.color = rgbToHex(gbBuffer.readUChar(), gbBuffer.readUChar(), gbBuffer.readUChar());
                        item.weight = gbBuffer.readUChar();
                        item.filled = (gbBuffer.readUChar() == 1);
                    }
                    else if (type == 4) {
                        item = {
                            id: this.generateID(),
                            cid: "unknown",
                            type,
                            rect: {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat(),
                                w: gbBuffer.readFloat(),
                                h: gbBuffer.readFloat()
                            },
                            color: "",
                            weight: 0,
                            start: {
                                x: 0,
                                y: 0
                            },
                            end: {
                                x: 0,
                                y: 0
                            }
                        };
                        item.color = rgbToHex(gbBuffer.readUChar(), gbBuffer.readUChar(), gbBuffer.readUChar());
                        item.weight = gbBuffer.readUChar();
                        item.start.x = gbBuffer.readFloat();
                        item.start.y = gbBuffer.readFloat();
                        item.end.x = gbBuffer.readFloat();
                        item.end.y = gbBuffer.readFloat();
                    }
                    else if (type == 5) {
                        item = {
                            id: this.generateID(),
                            cid: "unknown",
                            type,
                            rect: {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat(),
                                w: gbBuffer.readFloat(),
                                h: gbBuffer.readFloat()
                            },
                            src: ""
                        };
                        item.src = gbBuffer.readString();
                    }
                    else if (type == 6) {
                        item = {
                            id: this.generateID(),
                            cid: "unknown",
                            type,
                            rect: {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat(),
                                w: gbBuffer.readFloat(),
                                h: gbBuffer.readFloat()
                            },
                            text: "",
                            color: ""
                        };
                        item.text = gbBuffer.readString();
                        item.color = rgbToHex(gbBuffer.readUChar(), gbBuffer.readUChar(), gbBuffer.readUChar());
                    }
                    if (item != null)
                        board.items[item.id] = item;
                }
                callback(null, bid);
            }
            catch (e) {
                console.log(e);
                callback(new Error(e.message), "");
            }
        });
    }
}
exports.GreyBoard = GreyBoard;
