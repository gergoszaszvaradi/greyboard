import { app, board, viewport, toolbox } from "../lib/app.js"
import socket_client from "socket.io-client"
import * as Util from "../lib/util.js"

export interface IClient {
    cid : string;
    bid : string;
    x : number;
    y : number;
    name : string;
    afk : boolean;
}

export class ClientCoord {
    x : number;
    y : number;
    cx : number;
    cy : number;
    px : number;
    py : number;

    constructor(x : number, y : number) {
        this.x = this.cx = this.px = x;
        this.y = this.cy = this.py = y;
    }

    set(x : number, y : number){
        this.px = this.cx;
        this.py = this.cy;
        this.cx = x;
        this.cy = y;
    }

    interpolate(percent : number) {
        this.x = Util.quadLerp(this.x, this.px, this.cx, percent);
        this.y = Util.quadLerp(this.y, this.py, this.cy, percent);
    }
}

export class Socket {
    socket : SocketIOClient.Socket;
    cid : string;
    bid : string;
    clients : {[key : string] : IClient};
    clientCoords : {[key : string] : ClientCoord};
    lastHeathBeatTime : number;

    constructor(bid : string){
        this.socket = io.connect();
        this.cid = "";
        this.bid = bid;
        this.clients = {};
        this.clientCoords = {};
        this.lastHeathBeatTime = (new Date()).getTime();

        this.socket.on("connect", () => {
            this.cid = this.socket.id;

            let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
            this.send("connected", {
                cid: this.cid,
                bid: bid,
                x: mp.x,
                y: mp.y,
                name: window.localStorage.getItem("gb_name") || null,
                focused: true
            });
            this.clientCoords[this.cid] = new ClientCoord(app.mouse.x, app.mouse.y);
            
            this.socket.on("room:state", (data : any) => {
                this.clients = data.clients;
                let users = document.querySelector("#users");
                if(users) {
                    let abr = data.clients[this.cid].name.replace(/[^A-Z]/g, "");
                    users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${this.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.clients[this.cid].name}</div></div>`;
                    for(let cid in data.clients){
                        if(cid != this.cid){
                            abr = data.clients[cid].name.replace(/[^A-Z]/g, "");
                            users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.clients[cid].name}</div></div>`;
                        }
                    }
                }
                board.name = data;
                app.ui.setText("#board-static-name", data.name);
                board.public = data.public;
                if(data.public)
                    $("*[action=visibility] i").removeClass("mdi-lock-open").addClass("mdi-lock");
                else
                    $("*[action=visibility] i").removeClass("mdi-lock").addClass("mdi-lock-open");
                board.addFromObjects(Object.values(data.items));

            });

            this.socket.on("client:state", (data : {[key : string] : IClient}) => {
                let users = document.querySelector("#users");
                for(let c in data){
                    if(!(c in this.clientCoords)){
                        this.clientCoords[c] = new ClientCoord(data[c].x, data[c].y);
                    }
                    this.clientCoords[c].set(data[c].x, data[c].y);

                    if(c in this.clients){
                        if(this.clients[c].afk != data[c].afk){
                            if(users) {
                                if(data[c].afk)
                                    users.querySelector(`*[data-user="${c}"]`)?.classList.add("afk");
                                else
                                    users.querySelector(`*[data-user="${c}"]`)?.classList.remove("afk");
                            }
                        }
                    }
                }
                this.clients = data;
                this.lastHeathBeatTime = (new Date()).getTime();
            });
            
            this.socket.on("client:connect", (data : IClient) => {
                this.clients[data.cid] = data;
                this.clientCoords[data.cid] = new ClientCoord(this.clients[data.cid].x, this.clients[data.cid].y);
                let abr = data.name.replace(/[^A-Z]/g, "");
                let users = document.querySelector("#users");
                if(users) users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${data.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.name}</div></div>`;
            });

            this.socket.on("client:disconnect", (data : string) => {
                let users = document.querySelector("#users");
                if(users) users.querySelector(`*[data-user="${data}"]`)?.remove();
                delete this.clients[data];
                delete this.clientCoords[data];
            });

            this.socket.on("board:name", (data : any) => {
                board.name = data;
                app.ui.setText("#board-static-name", data);
            });
            this.socket.on("board:add", (data : any) => {
                board.addFromObjects(data);
            });
            this.socket.on("board:move", (data : any) => {
                board.move(data.ids, data.dx, data.dy);
                toolbox.select.clearSelection();
            });
            this.socket.on("board:scale", (data : any) => {
                board.scale(data.ids, data.dx, data.dy);
                toolbox.select.clearSelection();
            });
            this.socket.on("board:remove", (data : any) => {
                board.remove(data);
            });
            this.socket.on("board:clear", (data : any) => {
                board.clear();
            });
            this.socket.on("board:v", (data : any) => {
                board.public = data;
                if(data)
                    $("*[action=visibility] i").removeClass("mdi-lock-open").addClass("mdi-lock");
                else
                    $("*[action=visibility] i").removeClass("mdi-lock").addClass("mdi-lock-open");
            });

            this.update();
        });
    }

    send(event : string, data : any){
        this.socket.emit(event, {cid: this.cid, data: data});
    }

    update(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.send("client:update", {
            cid: this.cid,
            bid: this.bid,
            x: mp.x,
            y: mp.y,
            afk: !app.focused
        });
        setTimeout(() => {
            this.update();
        }, 100);
    }
}