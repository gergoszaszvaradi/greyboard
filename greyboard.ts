import socketio from "socket.io"
import http from "http"
import express from "express";
import fs from "fs";
import fetch from "node-fetch"
import generateName from "./nicknames.js"

export interface NetworkBoard {
    id : string;
    name : string;
    items : {[key : string] : any};
    clients : {[key : string] : Client};
    public : boolean;
}

export interface Client {
    sid : string;
    bid : string;
    x : number;
    y : number;
    name : string;
    afk : boolean;
}

export class GBBuffer {
    buffer : Buffer;
    offset : number;

    constructor(size : number = 0){
        this.buffer = Buffer.allocUnsafe(size);
        this.offset = 0;
    }

    static fromBuffer(b : Buffer){
        let gbBuffer = new GBBuffer();
        gbBuffer.buffer = b;
        return gbBuffer;
    }

    writeUChar(v : number){this.offset = this.buffer.writeUInt8(v, this.offset);}
    readUChar(){this.offset += 1; return this.buffer.readUInt8(this.offset - 1);}

    writeUInt(v : number){this.offset = this.buffer.writeUInt32BE(v, this.offset);}
    readUInt(){this.offset += 4; return this.buffer.readUInt32BE(this.offset - 4);}

    writeFloat(v : number){this.offset = this.buffer.writeFloatBE(v, this.offset);}
    readFloat(){this.offset += 4; return this.buffer.readFloatBE(this.offset - 4);}

    writeString(str : string){
        for(let c of str){
            this.offset = this.buffer.writeUInt8(c.charCodeAt(0), this.offset);
        }
        this.offset = this.buffer.writeUInt8(0, this.offset);
    }
    readString(){
        let str = "";
        while(true){
            let c = this.buffer.readUInt8(this.offset);
            this.offset++;
            if(c == 0) break;
            str += String.fromCharCode(c);
        }
        return str;
    }
}

export class GreyBoard {
    private loadedBoards : { [key : string] : NetworkBoard } = {};
    private io : socketio.Server;

    constructor(server : http.Server){

        this.createDebugBoard();

        this.io = socketio.listen(server);
        this.io.on("connection", (socket : socketio.Socket) => {
            console.log(`Socket ${socket.id} connected.`);
            
            let bid = "";

            socket.on("connected", (data) => {
                if(!this.boardExists(data.data.bid)){
                    socket.disconnect(true);
                    return;
                }
                for(let room in socket.rooms){
                    if(socket.id !== room) socket.leave(room);
                }
                bid = data.data.bid;
                socket.join(bid);
                if(data.data.name == null)
                    data.data.name = generateName();
                this.loadedBoards[bid].clients[socket.id] = data.data;
                socket.emit("room:state", this.loadedBoards[bid]);
                socket.broadcast.to(bid).emit("client:connect", data.data);
            });
            socket.on("disconnect", () => {
                console.log(`Socket ${socket.id} disconnected.`);
                if(!(bid in this.loadedBoards)) return;
                delete this.loadedBoards[bid].clients[socket.id];
                this.io.to(bid).emit("client:disconnect", socket.id);
            });

            socket.on("client:update", (data) => {
                if(data.cid in this.loadedBoards[data.data.bid].clients){
                    this.loadedBoards[data.data.bid].clients[data.cid].x = data.data.x;
                    this.loadedBoards[data.data.bid].clients[data.cid].y = data.data.y;
                    this.loadedBoards[data.data.bid].clients[data.cid].afk = data.data.afk;
                }
            });

            socket.on("board:name", (data) => {
                this.loadedBoards[bid].name = data.data;
                socket.broadcast.to(bid).emit("board:name", data.data);
            });
            socket.on("board:add", (data) => {
                for(let i in data.data)
                    this.loadedBoards[bid].items[data.data[i].id] = data.data[i];
                socket.broadcast.to(bid).emit("board:add", data.data);
            });
            socket.on("board:move", (data) => {
                for(let i of data.data.ids){
                    if(i in this.loadedBoards[bid].items){
                        this.loadedBoards[bid].items[i].rect.x -= data.data.dx;
                        this.loadedBoards[bid].items[i].rect.y -= data.data.dy;
                    }
                }
                socket.broadcast.to(bid).emit("board:move", data.data);
            });
            socket.on("board:scale", (data) => {
                let bb = {x: Infinity, y: Infinity, w: -Infinity, h: -Infinity};
                for(let i of data.data.ids){
                    let item = this.loadedBoards[bid].items[i];
                    if(item.rect.x < bb.x) bb.x = item.rect.x;
                    if(item.rect.x + item.rect.w > bb.w) bb.w = item.rect.x + item.rect.w;
                    if(item.rect.y < bb.y) bb.y = item.rect.y;
                    if(item.rect.y + item.rect.h > bb.h) bb.h = item.rect.y + item.rect.h;
                }
                bb.w -= bb.x;
                bb.h -= bb.y;

                for(let id of data.data.ids){
                    let item = this.loadedBoards[bid].items[id];
                    item.rect.x -= ((item.rect.x - bb.x) / bb.w) * data.data.dx;
                    item.rect.y -= ((item.rect.y - bb.y) / bb.h) * data.data.dy;
                    item.rect.w -= (item.rect.w / bb.w) * data.data.dx;
                    item.rect.h -= (item.rect.h / bb.h) * data.data.dy;
                }
                socket.broadcast.to(bid).emit("board:scale", data.data);
            });
            socket.on("board:remove", (data) => {
                for(let i in data.data)
                    if(data.data[i] in this.loadedBoards[bid].items)
                        delete this.loadedBoards[bid].items[data.data[i]];
                socket.broadcast.to(bid).emit("board:remove", data.data);
            });
            socket.on("board:clear", (data) => {
                for(let id in this.loadedBoards[bid])
                    delete this.loadedBoards[bid].items[id];
                socket.broadcast.to(bid).emit("board:clear", null);
            });
            socket.on("board:visibility", (data) => {
                this.loadedBoards[bid].public = data.data;
                socket.broadcast.to(bid).emit("board:v", data.data);
                console.log(data);
            });
        });
        this.hearthbeat();
        this.keepHostAlive();
    }

    hearthbeat(){
        for(let bid in this.loadedBoards){
            this.io.to(bid).emit("client:state", this.loadedBoards[bid].clients);
        }
        setTimeout(() => { this.hearthbeat(); }, 100);
    }

    keepHostAlive(){
        setTimeout(() => {
            if(Object.keys(this.io.sockets.connected).length > 0){
                fetch("https://greyboard.herokuapp.com/", {method: "get"}).then((res : any) => console.log("Keeping alive!"));
            }else{
                console.log("No connections on the server, shutting down...");
            }

            this.keepHostAlive();
        }, 1200000);
    }
    
    generateID() : string {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let id = "";
        for(let i = 0; i < 16; i++)
            id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }

    validateID(id : string) : boolean {
        return id.match(/^[A-z0-9]{16}$/) != null;
    }

    createTemporaryBoard() : string {
        let id = this.generateID();
        this.loadedBoards[id] = {
            id: id,
            name: "New board",
            items: {},
            clients: {},
            public: false
        };
        return id;
    }

    createDebugBoard() : string {
        let id = "0000000000000000"
        this.loadedBoards[id] = {
            id: id,
            name: "New board",
            items: {},
            clients: {},
            public: false
        };
        return id;
    }

    boardExists(id : string) : boolean {
        if(!this.validateID(id)) return false;

        return (id in this.loadedBoards);
    }

    getPublicBoards() : Array<NetworkBoard> {
        let publicBoards : Array<NetworkBoard> = [];
        for(let i in this.loadedBoards){
            if(this.loadedBoards[i].public)
                publicBoards.push(this.loadedBoards[i]);
        }
        return publicBoards;
    }

    writeToResponse(res : express.Response, bid : string) {
        if(!(bid in this.loadedBoards)) return;

        let board = this.loadedBoards[bid];
        let size = 4;
        let count = 0;
        for(let i in board.items){
            size += 1 + 4 * 4; // item type + rect
            if(board.items[i].type == 1){
                size += 3 + 1 + 4 + board.items[i].points.length * 2 * 4; // item color + weight + point count + points
            }else if(board.items[i].type == 2 || board.items[i].type == 3){
                size += 3 + 1 + 1; // color + weight + filled
            }else if(board.items[i].type == 4){
                size += 3 + 1 + 8 + 8; // color + weight + start + end
            }else if(board.items[i].type == 5){
                size += Buffer.byteLength(board.items[i].src) + 1;
            }
            count++;
        }

        let hexToRgb = function(hex : string) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        let buffer = new GBBuffer(size);
        buffer.writeUInt(count);
        for(let i in board.items){
            let item = board.items[i];
            buffer.writeUChar(item.type);
            buffer.writeFloat(item.rect.x);
            buffer.writeFloat(item.rect.y);
            buffer.writeFloat(item.rect.w);
            buffer.writeFloat(item.rect.h);

            if(item.type == 1){
                let color = hexToRgb(item.color);
                if(color == null) continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeUInt(item.points.length);
                for(let point of item.points){
                    buffer.writeFloat(point.x);
                    buffer.writeFloat(point.y);
                }
            }else if(item.type == 2 || item.type == 3){
                let color = hexToRgb(item.color);
                if(color == null) continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeUChar(item.filled);
            }else if(item.type == 4){
                let color = hexToRgb(item.color);
                if(color == null) continue;
                buffer.writeUChar(color.r);
                buffer.writeUChar(color.g);
                buffer.writeUChar(color.b);
                buffer.writeUChar(item.weight);
                buffer.writeFloat(item.start.x);
                buffer.writeFloat(item.start.y);
                buffer.writeFloat(item.end.x);
                buffer.writeFloat(item.end.y);
            }else if(item.type == 5){
                buffer.writeString(item.src);
            }
        }

        res.write(buffer.buffer);
    }

    loadFromFile(path : string, callback : (err : Error | null, bid : string) => void) {
        fs.readFile(path, (err, buffer) => {
            if(err){
                callback(new Error(err.message), "");
                return;
            }
            try{
                let gbBuffer = GBBuffer.fromBuffer(buffer);
                let bid = this.createTemporaryBoard();
                this.loadedBoards[bid].name = "Loaded board";
                let count = gbBuffer.readUInt();
                
                let rgbToHex = function(r : number, g : number, b : number) {
                    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                };

                for(let i = 0; i < count; i++){
                    let item = null;
                    let type = gbBuffer.readUChar();
                    if(type == 1){
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
                        for(let j = 0; j < pointCount; j++){
                            let point = {
                                x: gbBuffer.readFloat(),
                                y: gbBuffer.readFloat()
                            };
                            item.points.push(point);
                        }
                    }else if(type == 2 || type == 3){
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
                    }else if(type == 4){
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
                    }else if(type == 5){
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
                    if(item != null)
                        this.loadedBoards[bid].items[item.id] = item;
                }
                callback(null, bid);
            }catch(e){
                console.log(e);
                callback(new Error(e.message), "");
            }
        });
    }
}