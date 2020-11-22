import { app, board, viewport, toolbox } from "../lib/app.js";
import * as Util from "../lib/util.js";
export class ClientCoord {
    constructor(x, y) {
        this.x = this.cx = this.px = x;
        this.y = this.cy = this.py = y;
    }
    set(x, y) {
        this.px = this.cx;
        this.py = this.cy;
        this.cx = x;
        this.cy = y;
    }
    interpolate(percent) {
        this.x = Util.quadLerp(this.x, this.px, this.cx, percent);
        this.y = Util.quadLerp(this.y, this.py, this.cy, percent);
    }
}
export class Socket {
    constructor(bid) {
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
                name: window.localStorage.getItem("gb_name") || null
            });
            this.clientCoords[this.cid] = new ClientCoord(app.mouse.x, app.mouse.y);
            this.socket.on("room:state", (data) => {
                this.clients = data.clients;
                let users = document.querySelector("#users");
                if (users) {
                    let abr = data.clients[this.cid].name.replace(/[^A-Z]/g, "");
                    users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${this.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.clients[this.cid].name}</div></div>`;
                    for (let cid in data.clients) {
                        if (cid != this.cid) {
                            abr = data.clients[cid].name.replace(/[^A-Z]/g, "");
                            users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.clients[cid].name}</div></div>`;
                        }
                    }
                }
                board.addFromObjects(Object.values(data.items));
            });
            this.socket.on("client:state", (data) => {
                for (let c in data) {
                    if (!(c in this.clientCoords)) {
                        this.clientCoords[c] = new ClientCoord(data[c].x, data[c].y);
                    }
                    this.clientCoords[c].set(data[c].x, data[c].y);
                }
                this.clients = data;
                this.lastHeathBeatTime = (new Date()).getTime();
            });
            this.socket.on("client:connect", (data) => {
                this.clients[data.cid] = data;
                this.clientCoords[data.cid] = new ClientCoord(this.clients[data.cid].x, this.clients[data.cid].y);
                let abr = data.name.replace(/[^A-Z]/g, "");
                let users = document.querySelector("#users");
                if (users)
                    users.innerHTML += `<div class="toolbar-button" action="pan-to-user" data-user="${data.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${data.name}</div></div>`;
            });
            this.socket.on("client:disconnect", (data) => {
                var _a;
                let users = document.querySelector("#users");
                if (users)
                    (_a = users.querySelector(`*[data-user="${data}"]`)) === null || _a === void 0 ? void 0 : _a.remove();
                delete this.clients[data];
                delete this.clientCoords[data];
            });
            this.socket.on("board:name", (data) => {
                board.name = data;
                app.ui.setText("#board-static-name", data);
            });
            this.socket.on("board:add", (data) => {
                board.addFromObjects(data);
            });
            this.socket.on("board:move", (data) => {
                board.move(data.ids, data.dx, data.dy);
                toolbox.select.clearSelection();
            });
            this.socket.on("board:scale", (data) => {
                board.scale(data.ids, data.dx, data.dy);
                toolbox.select.clearSelection();
            });
            this.socket.on("board:remove", (data) => {
                board.remove(data);
            });
            this.socket.on("board:clear", (data) => {
                board.clear();
            });
            this.update();
        });
    }
    send(event, data) {
        this.socket.emit(event, { cid: this.cid, data: data });
    }
    update() {
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.send("client:update", {
            cid: this.cid,
            bid: this.bid,
            x: mp.x,
            y: mp.y
        });
        setTimeout(() => {
            this.update();
        }, 100);
    }
}
