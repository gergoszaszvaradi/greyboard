import { app, viewport, board, socket, toolbox } from "./app.js"
import * as Util from "./util.js"
import { BoardPath, BoardRectangle, BoardEllipse, BoardArrow, BoardItem } from "./board.js";
import { ActionStack } from "./action.js";

export class Toolbox {
    select = new Select();
    pencil = new Pencil();
    eraser = new Eraser();
    rectange = new Rectangle();
    fillrectangle = new FillRectangle();
    ellipse = new Ellipse();
    fillellipse = new FillEllipse();
    line = new Line();
    arrow = new Arrow();

    selected : Tool;
    color : string = "#fafafa";
    weight : number = 3;


    constructor(){
        this.selected = this.pencil;
    }

    selectTool(tool : Tool){
        this.selected.onDeSelected();
        this.selected = tool;
        this.selected.onSelected();

        app.ui.setActive("*[action^=tool]", `*[action=tool-${tool.name.toLowerCase()}]`);
    }

    selectColor(color : string){
        this.color = color;
        app.ui.setActive("*[action=set-color]", `*[color="${color}"]`);
    }
}

export class Tool {
    name : string = "";

    constructor(name : string){
        this.name = name;
    }

    onSelected(){};
    onDeSelected(){};

    onClickDown(){};
    onClickMove(){};
    onClickUp(){};

    onFrameUpdate(){};
    onDraw(){};
}

enum SelectToolMode {
    None,
    Select,
    Move,
    Scale
}
export class Select extends Tool {
    wasDragged : boolean = false;
    rect = new Util.ERect();
    bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
    selection : Array<string> = [];
    mode : SelectToolMode = SelectToolMode.None;
    moveStart = new Util.Point();
    scaleAspect = new Util.Point();
    moveSpeed : number = 1;

    constructor(){ super("Select"); }

    onSelected(){
        this.clearSelection();
    }
    onDeSelected(){
        this.clearSelection();
    }

    onClickDown(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(Util.isPointInRect(mp.x, mp.y, this.bb.x+this.bb.w-5 / viewport.scale, this.bb.y+this.bb.h-5 / viewport.scale, 10 / viewport.scale, 10 / viewport.scale)){
            this.mode = SelectToolMode.Scale;
            this.scaleAspect = new Util.Point(this.bb.w, this.bb.h);
            // if(app.keyboard.shift){
            //     // this.scaleAspect = this.bb.w / this.bb.h;
            // }
            app.setCursor("nwse-resize");
        }else if(Util.isPointInRect(mp.x, mp.y, this.bb.x, this.bb.y, this.bb.w, this.bb.h)){
            this.mode = SelectToolMode.Move;
            this.moveStart = new Util.Point(this.bb.x, this.bb.y);
            app.setCursor("move");
        }else{
            this.mode = SelectToolMode.Select;
            this.wasDragged = false;
            this.clearSelection();
            this.rect = new Util.ERect(mp.x, mp.y, 0, 0, mp.x, mp.y);
        }
    }

    onClickMove(){
        this.wasDragged = true;
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(this.mode == SelectToolMode.Select){
            if(mp.x > this.rect.ox){
                this.rect.x = this.rect.ox;
                this.rect.w = mp.x - this.rect.x;
            }else{
                this.rect.x = mp.x;
                this.rect.w = this.rect.ox - this.rect.x;
            }
            if(mp.y > this.rect.oy){
                this.rect.y = this.rect.oy;
                this.rect.h = mp.y - this.rect.y;
            }else{
                this.rect.y = mp.y;
                this.rect.h = this.rect.oy - this.rect.y;
            }

            this.clearSelection();
            board.each((item) => {
                if(!viewport.isRectInView(item.rect)) return;
                if(item.isInRect(this.rect)){
                    this.selection.push(item.id);
                }
            });
        }else if(this.mode == SelectToolMode.Move){
            let mpp = viewport.screenToViewport(app.mouse.px, app.mouse.py);
            let dx = mpp.x - mp.x;
            let dy = mpp.y - mp.y;
            this.moveSelection(dx, dy);
        }else if(this.mode == SelectToolMode.Scale){
            let mpp = viewport.screenToViewport(app.mouse.px, app.mouse.py);
            let dx = mpp.x - mp.x;
            let dy = mpp.y - mp.y;
            this.scaleSelection(dx, dy);
        }
    }

    onClickUp(){
        app.setCursor("default");
        if(this.wasDragged == false){
            let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
            board.each((item) => {
                if(!viewport.isRectInView(item.rect)) return;
                if(Util.isPointInRect(mp.x, mp.y, item.rect.x, item.rect.y, item.rect.w, item.rect.h)){
                    this.selection = [item.id];
                    return;
                }
            });
        }

        if(this.mode == SelectToolMode.Select){
            this.calculateBoundingBox();
            this.rect = new Util.ERect();
        } else if(this.mode == SelectToolMode.Move){
            ActionStack.add((data) => {
                board.move(data.ids, data.dx, data.dy);
                socket.send("board:move", data);
            }, (data) => {
                board.move(data.ids, -data.dx, -data.dy);
                socket.send("board:move", {ids: data.ids, dx: -data.dx, dy: -data.dy});
            }, {ids: this.selection, dx: this.moveStart.x - this.bb.x, dy: this.moveStart.y - this.bb.y}, false);
            socket.send("board:move", {ids: this.selection, dx: this.moveStart.x - this.bb.x, dy: this.moveStart.y - this.bb.y});
        } else if(this.mode == SelectToolMode.Scale){
            let sx = this.scaleAspect.x - this.bb.w;
            let sy = this.scaleAspect.y - this.bb.h;

            ActionStack.add((data) => {
                board.scale(data.ids, data.dx, data.dy);
                socket.send("board:scale", data);
            }, (data) => {
                board.scale(data.ids, -data.dx, -data.dy);
                socket.send("board:scale", {ids: data.ids, dx: -data.dx, dy: -data.dy});
            }, {ids: this.selection, dx: sx, dy: sy}, false);
            socket.send("board:scale", {ids: this.selection, dx: sx, dy: sy});
        }
        this.mode = SelectToolMode.None;
    }

    calculateBoundingBox(){
        this.bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
        for(let i of this.selection){
            let item = board.items[i];
            if(item.rect.x < this.bb.x) this.bb.x = item.rect.x;
            if(item.rect.x + item.rect.w > this.bb.w) this.bb.w = item.rect.x + item.rect.w;
            if(item.rect.y < this.bb.y) this.bb.y = item.rect.y;
            if(item.rect.y + item.rect.h > this.bb.h) this.bb.h = item.rect.y + item.rect.h;
        }
        this.bb.w -= this.bb.x;
        this.bb.h -= this.bb.y;
    }

    moveSelection(dx : number, dy : number){
        board.move(this.selection, dx, dy);
        this.bb.x -= dx;
        this.bb.y -= dy;
    }
    scaleSelection(dx : number, dy : number){
        if(this.bb.w - dx < 10 || this.bb.h - dy < 10) return;

        if(app.keyboard.shift){
            let aspectRatio = this.scaleAspect.x / this.scaleAspect.y;
            dy = this.bb.h - ((this.bb.w - dx) / aspectRatio);
        }

        for(let i of this.selection){
            let item = board.items[i];
            item.rect.x -= ((item.rect.x - this.bb.x) / this.bb.w) * dx;
            item.rect.y -= ((item.rect.y - this.bb.y) / this.bb.h) * dy;
            item.rect.w -= (item.rect.w / this.bb.w) * dx;
            item.rect.h -= (item.rect.h / this.bb.h) * dy;
        }
        this.bb.w -= dx;
        this.bb.h -= dy;
    }
    deleteSelection(){
        let items = [];
        let ids = []
        for(let i of this.selection){
            ids.push(i);
            items.push(board.items[i]);
        }
        ActionStack.add((data) => {
            board.remove(data.ids);
            socket.send("board:remove", data.ids);
        }, (data) => {
            board.add(data.items);
            socket.send("board:add", data.items);
        }, {ids, items});
        this.clearSelection();
    }
    clearSelection(){
        this.selection = [];
        this.bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
    }
    copySelection(data : DataTransfer){
        let objs : Array<object> = [];
        for(let id of this.selection){
            objs.push(board.items[id] as object);
        }
        navigator.clipboard.writeText(JSON.stringify(objs));
    }

    onDraw(){
        if(this.rect.w * this.rect.h > 0){
            app.graphics.fill("#FFFFFF50");
            app.graphics.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        }
        
        if(this.selection.length == 0) return;

        if(app.keyboard.pressed == true){
            this.moveSpeed += 0.02;
            if(this.moveSpeed > 3) this.moveSpeed = 3;
            if(app.keyboard.key == 37) this.moveSelection(1 * this.moveSpeed, 0);
            if(app.keyboard.key == 38) this.moveSelection(0, 1 * this.moveSpeed);
            if(app.keyboard.key == 39) this.moveSelection(-1 * this.moveSpeed, 0);
            if(app.keyboard.key == 40) this.moveSelection(0, -1 * this.moveSpeed);
        }else this.moveSpeed = 1;

        if(app.mouse.pressed || this.selection.length > 1){
            app.graphics.stroke("#FFFFFF30", 1 / viewport.scale);
            app.graphics.dash([5, 5]);
            for(let i of this.selection){
                let item = board.items[i];
                if(item == null) continue; // temp, selection is still populated but it should not be
                app.graphics.rect(item.rect.x, item.rect.y, item.rect.w, item.rect.h);
            }
            app.graphics.dash([]);
        }
        if(this.bb.w == 0 || this.bb.h == 0) return;
        app.graphics.stroke("#FFFFFFAA", 1 / viewport.scale);
        app.graphics.rect(this.bb.x, this.bb.y, this.bb.w, this.bb.h);
        app.graphics.fill("#FFFFFF");
        app.graphics.fillEllipse(this.bb.x+this.bb.w, this.bb.y+this.bb.h, 5 / viewport.scale, 5 / viewport.scale);
        app.graphics.stroke("#00000044", 1);
        app.graphics.ellipse(this.bb.x+this.bb.w, this.bb.y+this.bb.h, 5 / viewport.scale, 5 / viewport.scale);

        if(this.mode == SelectToolMode.Scale && app.mouse.pressed){
            app.graphics.font("Arial", 14 / viewport.scale, "left", "top");
            app.graphics.text(this.bb.x+this.bb.w + 10 / viewport.scale, this.bb.y+this.bb.h + 10 / viewport.scale, `${Math.floor(this.bb.w)} × ${Math.floor(this.bb.h)} px`);
        }
    }
}

export class Pencil extends Tool {
    buffer : Array<Util.Point> = [];

    constructor(){ super("Pencil"); }

    onClickDown(){
        this.buffer.push(viewport.screenToViewport(app.mouse.x, app.mouse.y));
    }
    onClickMove(){
        this.buffer.push(viewport.screenToViewport(app.mouse.x, app.mouse.y));
    }
    onClickUp(){
        if(this.buffer.length == 0) return;
        this.buffer.push(viewport.screenToViewport(app.mouse.x, app.mouse.y));

        let path = new BoardPath(socket.cid, this.buffer, toolbox.color, toolbox.weight);

        path.optimize();
        path.calculateRect();
        path.normalize();

        ActionStack.add((data) => {
            board.add([data]);
            socket.send("board:add", [data]);
        }, (data) => {
            board.remove([data.id]);
            socket.send("board:remove", [data.id]);
        }, path);

        this.buffer = [];
    }

    onDraw(){
        if(this.buffer == null || this.buffer.length == 0) return;

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.curve(this.buffer);
    }
}

export class Eraser extends Tool {
    trail : Array<Util.Point> = [];

    constructor(){ super("Eraser"); }

    onClickDown(){
        this.trail = [];
    }
    onClickUp(){
        this.trail = [];
    }

    onFrameUpdate(){
        if(app.mouse.pressed && app.mouse.button == 0){
            if(this.trail.length > 5) this.trail.shift();
            let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
            this.trail.push(mp);

            board.each((item) => {
                if(!viewport.isRectInView(item.rect)) return;

                let bbarea = item.rect.w * item.rect.h;
                if(bbarea < 10) {
                    if(Util.isPointInRect(mp.x, mp.y, item.rect.x-5, item.rect.y-5, 10, 10)){
                        ActionStack.add((data) => {
                            board.remove([data.id]);
                            socket.send("board:remove", [data.id]);
                        }, (data) => {
                            board.add([data]);
                            socket.send("board:add", [data]);
                        }, item);
                    }
                }else{
                    let mpp = viewport.screenToViewport(app.mouse.px, app.mouse.py);
                    if(item.isInLine(mpp.x, mpp.y, mp.x, mp.y)){
                        ActionStack.add((data) => {
                            board.remove([data.id]);
                            socket.send("board:remove", [data.id]);
                        }, (data) => {
                            board.add([data]);
                            socket.send("board:add", [data]);
                        }, item);
                    }
                }
            });
        }
    }

    onDraw(){
        if(this.trail == null || this.trail.length == 0) return;

        app.graphics.stroke("#ffffff50", 4 / viewport.scale);
        app.graphics.curve(this.trail);
    }
}

export class Rectangle extends Tool {
    drawing = false;
    start = new Util.Point();
    filled = false;

    constructor() { super("Rectangle"); }

    onClickDown(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(end.x < this.start.x){
            let t = this.start.x;
            this.start.x = end.x;
            end.x = t;
        }
        if(end.y < this.start.y){
            let t = this.start.y;
            this.start.y = end.y;
            end.y = t;
        }
        let rectangle = new BoardRectangle(socket.cid, this.start.x, this.start.y, end.x - this.start.x, end.y - this.start.y, toolbox.color, toolbox.weight, this.filled);

        ActionStack.add((data) => {
            board.add([data]);
            socket.send("board:add", [data]);
        }, (data) => {
            board.remove([data.id]);
            socket.send("board:remove", [data.id]);
        }, rectangle);

        this.start = new Util.Point();
        this.drawing = false;
    }

    onDraw(){
        if(!this.drawing) return;
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(this.filled){
            app.graphics.fill(toolbox.color);
            app.graphics.fillRect(this.start.x, this.start.y, mp.x - this.start.x, mp.y - this.start.y);
        }else{
            app.graphics.stroke(toolbox.color, toolbox.weight);
            app.graphics.rect(this.start.x, this.start.y, mp.x - this.start.x, mp.y - this.start.y);
        }
    }
}
export class FillRectangle extends Rectangle{
    constructor(){
        super();
        this.name = "FillRectangle";
        this.filled = true;
    }
}

export class Ellipse extends Tool {
    drawing = false;
    start = new Util.Point();
    filled = false;

    constructor() { super("Ellipse"); }

    onClickDown(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(end.x < this.start.x){
            let t = this.start.x;
            this.start.x = end.x;
            end.x = t;
        }
        if(end.y < this.start.y){
            let t = this.start.y;
            this.start.y = end.y;
            end.y = t;
        }
        let ellipse = new BoardEllipse(socket.cid, this.start.x, this.start.y, end.x - this.start.x, end.y - this.start.y, toolbox.color, toolbox.weight, this.filled);

        ActionStack.add((data) => {
            board.add([data]);
            socket.send("board:add", [data]);
        }, (data) => {
            board.remove([data.id]);
            socket.send("board:remove", [data.id]);
        }, ellipse);

        this.start = new Util.Point();
        this.drawing = false;
    }

    onDraw(){
        if(!this.drawing) return;
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(this.filled){
            app.graphics.fill(toolbox.color);
            app.graphics.fillEllipse(this.start.x + (mp.x - this.start.x) / 2, this.start.y + (mp.y - this.start.y) / 2, Math.abs((mp.x - this.start.x) / 2), Math.abs((mp.y - this.start.y) / 2));
        }else{
            app.graphics.stroke(toolbox.color, toolbox.weight);
            app.graphics.ellipse(this.start.x + (mp.x - this.start.x) / 2, this.start.y + (mp.y - this.start.y) / 2, Math.abs((mp.x - this.start.x) / 2), Math.abs((mp.y - this.start.y) / 2));
        }
    }
}
export class FillEllipse extends Ellipse{
    constructor(){
        super();
        this.name = "FillEllipse";
        this.filled = true;
    }
}

export class Line extends Tool {
    drawing = false;
    start = new Util.Point();

    constructor() { super("Line"); }

    onClickDown(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        let line = new BoardPath(socket.cid, [this.start, end], toolbox.color, toolbox.weight);

        line.calculateRect();
        line.normalize();

        ActionStack.add((data) => {
            board.add([data]);
            socket.send("board:add", [data]);
        }, (data) => {
            board.remove([data.id]);
            socket.send("board:remove", [data.id]);
        }, line);

        this.start = new Util.Point();
        this.drawing = false;
    }

    onDraw(){
        if(!this.drawing) return;
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.line(this.start.x, this.start.y, mp.x, mp.y);
    }
}
export class Arrow extends Tool{
    drawing = false;
    start = new Util.Point();

    constructor() { super("Arrow"); }

    onClickDown(){
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.mouse.x, app.mouse.y);
        if(end.x == this.start.x && end.y == this.start.y) return;

        let arrow = new BoardArrow(socket.cid, this.start.x, this.start.y, end.x, end.y, toolbox.color, toolbox.weight);

        arrow.calculateRect();
        arrow.normalize();

        ActionStack.add((data) => {
            board.add([data]);
            socket.send("board:add", [data]);
        }, (data) => {
            board.remove([data.id]);
            socket.send("board:remove", [data.id]);
        }, arrow);

        this.start = new Util.Point();
        this.drawing = false;
    }

    onDraw(){
        if(!this.drawing) return;
        let mp = viewport.screenToViewport(app.mouse.x, app.mouse.y);

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.line(this.start.x, this.start.y, mp.x, mp.y);
    }
}