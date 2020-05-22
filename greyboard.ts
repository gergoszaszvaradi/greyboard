import socketio from "socket.io"
import http from "http"
import express from "express";
import fs from "fs";

export interface Board{
    id : string,
    name : string,
    items : {[key : string] : any},
    clients : {[key : string] : Client};
};
export enum BoardItemType{
    None = 0,
    Path = 1,
    Rectangle = 2,
    Ellipse = 3,
    Arrow = 4,
    Image = 5
};

export interface Client {
    sid : string;
    bid : string;
    x : number;
    y : number;
    name : string;
}

export class GreyBoard {
    private loadedBoards : { [key : string] : Board } = {};
    private io : socketio.Server;

    constructor(server : http.Server){

        this.createDebugBoard();

        this.io = socketio.listen(server);
        this.io.on("connection", (socket : socketio.Socket) => {
            console.log(`Socket ${socket.id} connected.`);
            
            let bid = "";

            socket.on("connected", (data) => {
                if(!this.boardExists(data.data.bid)){
                    socket.disconnect(true)
                    return;
                }
                for(let room in socket.rooms){
                    if(socket.id !== room) socket.leave(room);
                }
                bid = data.data.bid;
                socket.join(bid);
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
                if(data.cid in this.loadedBoards[data.data.bid].clients)
                    this.loadedBoards[data.data.bid].clients[data.cid] = data.data;
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
        });
        this.hearthbeat();
    }

    hearthbeat(){
        for(let bid in this.loadedBoards){
            this.io.to(bid).emit("client:state", this.loadedBoards[bid].clients);
        }
        setTimeout(() => { this.hearthbeat(); }, 100);
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
            clients: {}
        };
        return id;
    }

    createDebugBoard() : string {
        let id = "0000000000000000"
        this.loadedBoards[id] = {
            id: id,
            name: "New board",
            items: {},
            clients: {}
        };
        return id;
    }

    boardExists(id : string) : boolean {
        if(!this.validateID(id)) return false;

        return (id in this.loadedBoards);
    }


    writeToResponse(res : express.Response, bid : string) {
        if(!(bid in this.loadedBoards)) return;

        let board = this.loadedBoards[bid];
        res.write(JSON.stringify({
            name: this.loadedBoards[bid].name,
            items: this.loadedBoards[bid].items
        }));
    }

    loadFromFile(path : string, callback : (err : Error | null, bid : string) => void) {
        fs.readFile(path, (err, data) => {
            if(err){
                callback(new Error(err.message), "");
                return;
            }
            try{
                let content = JSON.parse(data.toString());
                let bid = this.createTemporaryBoard();
                this.loadedBoards[bid].name = content.name;
                this.loadedBoards[bid].items = content.items;
                console.log(this.loadedBoards[bid]);
                callback(null, bid);
            }catch(e){
                console.log(e);
                callback(new Error(e.message), "");
            }
        });
    }
}