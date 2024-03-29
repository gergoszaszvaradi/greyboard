import { Application } from "./core.js"
import Viewport from "./viewport.js";
import { Board } from "./board.js";
import { SelectTool, Toolbox } from "./tool.js";
import { Socket } from "./socket.js";
import * as Util from "./util.js";
import { ActionStack } from "./action.js"
import Exporter from "./exporter.js";

export let app = new Application();
export let viewport = new Viewport();
export let board = new Board();
export let toolbox = new Toolbox();

let bid = window.location.pathname.substr(window.location.pathname.length-16, 16);
export let socket = new Socket(bid);


app.onpointerdown.add(() => {
    if(app.pointer.button == 0){
        if (toolbox.selected.isUsing)
            toolbox.selected.onClickCanceled();
        else
            toolbox.selected.onClickDown();
    }
});

app.onpointermove.add(() => {
    if(app.pointer.pressed){
        if(app.pointer.button == 0)
            toolbox.selected.onClickMove();
        else if(app.pointer.button == 1)
            viewport.pan(app.pointer.x - app.pointer.px, app.pointer.y - app.pointer.py);
    }
});

app.onpointerpinch.add((d) => {
    viewport.multiplyZoom(app.pointer.cx, app.pointer.cy, d);
});

app.onpointerup.add(() => {
    if(toolbox.selected.isUsing)
        toolbox.selected.onClickUp();
});

app.onmousewheel.add((dx : number, dy : number) => {
    viewport.zoom(app.pointer.cx, app.pointer.cy, dy * 0.03);
});
app.onfocuschanged.add((state : boolean) => {
    socket.send("client:afk", !state);
});

app.onupdate.add((ts : number) => {
    app.graphics.clear("#222222");
    app.graphics.setView(viewport.position, viewport.scale);
    board.draw();

    toolbox.selected.onFrameUpdate();
    toolbox.selected.onDraw();

    app.graphics.font("Arial", 14 / viewport.scale, "left", "middle");

    let percent = ((new Date()).getTime() - socket.lastHeathBeatTime)/200;
    for(let cid in socket.clientCoords){
        if(cid == socket.cid) continue;
        if(socket.clients[cid]){
            socket.clientCoords[cid].interpolate(percent);
            if(socket.clients[cid].afk){
                app.graphics.img(socket.clientCoords[cid].x, socket.clientCoords[cid].y, 16 / viewport.scale, 16 / viewport.scale, "/images/cursor_afk.png");
                app.graphics.fill("#fc821084");
            }else{
                app.graphics.img(socket.clientCoords[cid].x, socket.clientCoords[cid].y, 16 / viewport.scale, 16 / viewport.scale, "/images/cursor.png");
                app.graphics.fill("#fc8210ff");
            }
            app.graphics.text(socket.clientCoords[cid].x + 24 / viewport.scale, socket.clientCoords[cid].y + 8 / viewport.scale, socket.clients[cid].name);
        }
    }
});

app.oncopy.add((data) => {
    (toolbox.getTool("select") as SelectTool).copySelection(data);
});
app.onpaste.add((data) => {
    board.addFromClipboard(data);
}); 

app.ui.onaction.add((action : string, e : Element) => {
    if(action.startsWith("tool-")){
        toolbox.selectTool(action.substring(5, action.length));
        return;
    }

    switch(action){
        case "save":
            window.open(`/b/${socket.bid}/save`);
            break;
        case "export":
            app.ui.showExportWindow();
            break;
        case "export-png":
            Exporter.exportAsPNG();
            app.ui.hideWindows();
        case "visibility":
            socket.send("board:visibility", !board.public);
            board.public = !board.public;
            if(board.public)
                app.ui.setToolbarButtonIcon("visibility", "mdi-lock-open-variant");
            else
                app.ui.setToolbarButtonIcon("visibility", "mdi-lock");
            break;
        case "clear":
            if(confirm("Are you sure you want to clear the board?")){
                board.items = {};
                socket.send("board:clear", null);
            }
            break;
        case "undo":
            ActionStack.undo();
            break;
        case "redo":
            ActionStack.redo();
            break;
        case "zoomin":
            viewport.zoom(app.width / 2, app.height / 2, -0.5);
            break;
        case "zoomout":
            viewport.zoom(app.width / 2, app.height / 2, 0.5);
            break;
        case "set-color":
            let color = $(e).data("color");
            if(color)
                toolbox.selectColor(color);
            break;
        case "pan-to-user":
            let cid = e.getAttribute("data-user");
            if(cid && cid != socket.cid){
                viewport.panTo(socket.clientCoords[cid].x, socket.clientCoords[cid].y);
            }
            break;
    }
});

app.registerShortcut(90, true, false, false, () => { ActionStack.undo(); });
app.registerShortcut(90, true, true, false, () => { ActionStack.redo(); });
app.registerShortcut(46, false, false, false, () => { (toolbox.getTool("select") as SelectTool).deleteSelection(); });

app.registerShortcut(83, false, false, false, () => { toolbox.selectTool("select"); });
app.registerShortcut(66, false, false, false, () => { toolbox.selectTool("pencil"); });
app.registerShortcut(69, false, false, false, () => { toolbox.selectTool("eraser"); });
app.registerShortcut(76, false, false, false, () => { toolbox.selectTool("line"); });
app.registerShortcut(82, false, false, false, () => { toolbox.selectTool("rectange"); });
app.registerShortcut(82, false, true, false, () => { toolbox.selectTool("fillrectangle"); });
app.registerShortcut(67, false, false, false, () => { toolbox.selectTool("ellipse"); });
app.registerShortcut(67, false, true, false, () => { toolbox.selectTool("fillellipse"); });
app.registerShortcut(65, false, false, false, () => { toolbox.selectTool("arrow"); });

ActionStack.onundo.add(() => {
    (toolbox.getTool("select") as SelectTool).clearSelection();
});
ActionStack.onredo.add(() => {
    (toolbox.getTool("select") as SelectTool).clearSelection();
});