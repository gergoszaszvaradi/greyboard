import { app, viewport, board, socket, toolbox } from "./app.js"
import * as Util from "./util.js"
import { BoardPath, BoardRectangle, BoardEllipse, BoardArrow, BoardItem, BoardText, BoardItemType } from "./board.js";
import { ActionStack } from "./action.js";

export class Toolbox {
    tools : Array<Tool>;
    selected : Tool;
    color : string = "#fafafa";
    weight : number = 3;

    constructor(){
        this.tools = [
            new PencilTool(),
            new SelectTool(),
            new EraserTool(),
            new RectangleTool(),
            new FillRectangleTool(),
            new EllipseTool(),
            new FillEllipseTool(),
            new LineTool(),
            new ArrowTool(),
            new TextTool()
        ];
        this.selected = this.tools[0] as Tool;
    }
    
    getTool(name : string) : Tool | null {
        for(let t of this.tools){
            if(t.name.toLowerCase() == name.toLowerCase())
                return t;
        }
        return null;
    }

    selectTool(name : string){
        let tool = this.getTool(name);
        if(tool){
            this.selected.onDeSelected();
            this.selected = tool;
            this.selected.onSelected();

            app.ui.setToolActive(this.selected.name.toLowerCase());
        }
    }

    selectColor(color : string){
        this.color = color;
        app.ui.setColorActive(color);
    }
}

export class Tool {
    name : string = "";
    isUsing : boolean = false;

    constructor(name : string){
        this.name = name;
    }

    onSelected(){};
    onDeSelected(){};

    onClickDown(){
        this.isUsing = true;
    }
    onClickMove(){};
    onClickUp(){
        this.isUsing = false;
    }
    onClickCanceled(){
        this.isUsing = false;
    }

    onFrameUpdate(){};
    onDraw(){};
}

enum SelectToolMode {
    None,
    Select,
    Move,
    Scale
}
export class SelectTool extends Tool {
    wasDragged : boolean = false;
    rect = new Util.ERect();
    bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
    selection : Array<string> = [];
    mode : SelectToolMode = SelectToolMode.None;
    moveStart = new Util.Point();
    scaleAspect = new Util.Point();
    moveSpeed : number = 1;
    movingWithKeyboard : boolean = false;

    constructor(){ super("Select"); }

    onSelected(){
        this.clearSelection();
    }
    onDeSelected(){
        this.clearSelection();
    }

    onClickDown(){
        super.onClickDown();
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        if(Util.isPointInRect(mp.x, mp.y, this.bb.x+this.bb.w-5 / viewport.scale, this.bb.y+this.bb.h-5 / viewport.scale, 10 / viewport.scale, 10 / viewport.scale)){
            this.mode = SelectToolMode.Scale;
            this.scaleAspect = new Util.Point(this.bb.w, this.bb.h);
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
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
            let mpp = viewport.screenToViewport(app.pointer.px, app.pointer.py);
            let dx = mpp.x - mp.x;
            let dy = mpp.y - mp.y;
            this.moveSelection(dx, dy);
        }else if(this.mode == SelectToolMode.Scale){
            let mpp = viewport.screenToViewport(app.pointer.px, app.pointer.py);
            let dx = mpp.x - mp.x;
            let dy = mpp.y - mp.y;
            this.scaleSelection(dx, dy);
        }
    }

    onClickUp(){
        super.onClickUp();
        app.setCursor("default");
        if(this.wasDragged == false){
            let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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

        if(app.keyboard.isPressed(16)){ // shift
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

        if(app.keyboard.arePressed([37, 38, 39, 40])){
            if(this.movingWithKeyboard == false) {
                this.moveStart = new Util.Point(this.bb.x, this.bb.y);
                this.movingWithKeyboard = true;
            }

            this.moveSpeed += 0.02;
            if(this.moveSpeed > 3) this.moveSpeed = 3;
            if(app.keyboard.isPressed(37)) this.moveSelection(1 * this.moveSpeed, 0);
            if(app.keyboard.isPressed(38)) this.moveSelection(0, 1 * this.moveSpeed);
            if(app.keyboard.isPressed(39)) this.moveSelection(-1 * this.moveSpeed, 0);
            if(app.keyboard.isPressed(40)) this.moveSelection(0, -1 * this.moveSpeed);
        }else{
            if(this.movingWithKeyboard){
                socket.send("board:move", {ids: this.selection, dx: this.moveStart.x - this.bb.x, dy: this.moveStart.y - this.bb.y});
                this.movingWithKeyboard = false;
            }
            this.moveSpeed = 1;
        }

        if(app.pointer.pressed || this.selection.length > 1){
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

        if(this.mode == SelectToolMode.Scale && app.pointer.pressed){
            app.graphics.font("Arial", 14 / viewport.scale, "left", "top");
            app.graphics.text(this.bb.x+this.bb.w + 10 / viewport.scale, this.bb.y+this.bb.h + 10 / viewport.scale, `${Math.floor(this.bb.w)} × ${Math.floor(this.bb.h)} px`);
        }
    }
}

export class PencilTool extends Tool {
    buffer : Array<Util.Point> = [];

    constructor(){ super("Pencil"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        this.buffer.push(viewport.screenToViewport(app.pointer.x, app.pointer.y));
    }
    onClickMove(){
        this.buffer.push(viewport.screenToViewport(app.pointer.x, app.pointer.y));
    }
    onClickUp(){
        super.onClickUp();
        if(this.buffer.length == 0) return;
        this.buffer.push(viewport.screenToViewport(app.pointer.x, app.pointer.y));

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
    onClickCanceled() {
        this.buffer = [];
    }

    onDraw(){
        if(this.buffer == null || this.buffer.length == 0) return;

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.curve(this.buffer);
    }
}

export class EraserTool extends Tool {
    trail : Array<Util.Point> = [];

    constructor(){ super("Eraser"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        this.trail = [];
    }
    onClickUp(){
        super.onClickUp();
        this.trail = [];
    }

    onFrameUpdate(){
        if(app.pointer.pressed && app.pointer.button == 0){
            if(this.trail.length > 5) this.trail.shift();
            let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
                    let mpp = viewport.screenToViewport(app.pointer.px, app.pointer.py);
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

export class RectangleTool extends Tool {
    drawing = false;
    start = new Util.Point();
    filled = false;

    constructor() { super("Rectangle"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        super.onClickUp();
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        if(this.filled){
            app.graphics.fill(toolbox.color);
            app.graphics.fillRect(this.start.x, this.start.y, mp.x - this.start.x, mp.y - this.start.y);
        }else{
            app.graphics.stroke(toolbox.color, toolbox.weight);
            app.graphics.rect(this.start.x, this.start.y, mp.x - this.start.x, mp.y - this.start.y);
        }
    }
}
export class FillRectangleTool extends RectangleTool{
    constructor(){
        super();
        this.name = "FillRectangle";
        this.filled = true;
    }
}

export class EllipseTool extends Tool {
    drawing = false;
    start = new Util.Point();
    filled = false;

    constructor() { super("Ellipse"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        super.onClickUp();
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        if(this.filled){
            app.graphics.fill(toolbox.color);
            app.graphics.fillEllipse(this.start.x + (mp.x - this.start.x) / 2, this.start.y + (mp.y - this.start.y) / 2, Math.abs((mp.x - this.start.x) / 2), Math.abs((mp.y - this.start.y) / 2));
        }else{
            app.graphics.stroke(toolbox.color, toolbox.weight);
            app.graphics.ellipse(this.start.x + (mp.x - this.start.x) / 2, this.start.y + (mp.y - this.start.y) / 2, Math.abs((mp.x - this.start.x) / 2), Math.abs((mp.y - this.start.y) / 2));
        }
    }
}
export class FillEllipseTool extends EllipseTool{
    constructor(){
        super();
        this.name = "FillEllipse";
        this.filled = true;
    }
}

export class LineTool extends Tool {
    drawing = false;
    start = new Util.Point();

    constructor() { super("Line"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        super.onClickUp();
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.line(this.start.x, this.start.y, mp.x, mp.y);
    }
}
export class ArrowTool extends Tool{
    drawing = false;
    start = new Util.Point();

    constructor() { super("Arrow"); }

    onDeSelected() { this.onClickUp(); }

    onClickDown(){
        super.onClickDown();
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        this.start = new Util.Point(mp.x, mp.y);
        this.drawing = true;
    }

    onClickUp(){
        super.onClickUp();
        if(!this.drawing) return;
        
        let end = viewport.screenToViewport(app.pointer.x, app.pointer.y);
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
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);

        app.graphics.stroke(toolbox.color, toolbox.weight);
        app.graphics.line(this.start.x, this.start.y, mp.x, mp.y);
    }
}

export class TextTool extends Tool{
    private textarea : JQuery<HTMLElement>;
    private currentText : BoardText | null = null;
    private editing : boolean = false;
    private creatingNew : boolean = false;
    private pos : Util.Point = new Util.Point();

    constructor() {
        super("Text");
        this.textarea = $("#text-tool-textarea");

        app.onkeydown.add((keyCode) => {
            if(keyCode == 27)
                this.endEditing();
        });

        // this.textarea.on("mousedown", (e) => {
        //     if(e.button == 1)
        //         this.endEditing();
        // });
    }

    endEditing(){
        if(this.editing){
            let text = this.textarea.val() as string;
            if(text.trim() != ""){
                if(this.creatingNew){
                    let item = new BoardText(socket.cid, this.pos.x, this.pos.y, 0, 20, toolbox.color, "");
                    item.setText(text);

                    ActionStack.add((data) => {
                        board.add([data]);
                        socket.send("board:add", [data]);
                    }, (data) => {
                        board.remove([data.id]);
                        socket.send("board:remove", [data.id]);
                    }, item);
                }else{
                    if(this.currentText != null) {
                        let item = new BoardText(socket.cid, this.currentText.rect.x, this.currentText.rect.y, this.currentText.rect.w, this.currentText.rect.h, this.currentText.color, this.currentText.text);
                        item.setText(text);
                        this.currentText.visible = true;
                        ActionStack.add((data) => {
                            board.remove([data.old.id]);
                            board.add([data.new]);
                            socket.send("board:remove", [data.old.id]);
                            socket.send("board:add", [data.new]);
                        }, (data) => {
                            board.remove([data.new.id]);
                            board.add([data.old]);
                            socket.send("board:remove", [data.new.id]);
                            socket.send("board:add", [data.old]);
                        }, {old: this.currentText, new: item});

                        this.currentText = null;
                    }
                }
            }
            this.textarea.hide();
            this.editing = false;
            this.creatingNew = false;
        }
    }

    onDeSelected() {
        this.endEditing();
    }

    onClickUp(){
        super.onClickUp();
        this.endEditing();
        this.editing = true;
        this.creatingNew = true;

        this.pos = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        board.each((item) => {
            if(!viewport.isRectInView(item.rect) || item.type != BoardItemType.Text) return;
            if(Util.isPointInRect(this.pos.x, this.pos.y, item.rect.x, item.rect.y, item.rect.w, item.rect.h)){
                this.creatingNew = false;
                this.currentText = item as BoardText;
                
                let ip = viewport.viewportToScreen(this.currentText.rect.x, this.currentText.rect.y);
                let lineHeight = this.currentText.rect.h / this.currentText.text.split('\n').length;
                this.textarea.val(this.currentText.text).css({
                    left: ip.x + "px",
                    top: ip.y + "px",
                    width: (app.width - ip.x) + "px",
                    height: (app.height - ip.y) + "px",
                    fontSize: lineHeight * viewport.scale,
                    color: this.currentText.color
                }).show().select();

                this.currentText.visible = false;
                (toolbox.getTool("select") as SelectTool).clearSelection();
            }
        });

        if(this.creatingNew){
            this.textarea.val("").css({
                left: app.pointer.x + "px",
                top: app.pointer.y + "px",
                width: (app.width - app.pointer.x) + "px",
                height: (app.height - app.pointer.y) + "px",
                fontSize: 20 * viewport.scale,
                color: toolbox.color
            }).show().select();
        }
    }

    onDraw(){
        if(this.editing) return;
        let mp = viewport.screenToViewport(app.pointer.x, app.pointer.y);
        board.each((item) => {
            app.graphics.stroke("#FFFFFF30", 1 / viewport.scale);
            if(!viewport.isRectInView(item.rect) || item.type != BoardItemType.Text) return;
            if(Util.isPointInRect(mp.x, mp.y, item.rect.x, item.rect.y, item.rect.w, item.rect.h)){
                app.graphics.rect(item.rect.x, item.rect.y, item.rect.w, item.rect.h);
            }
        });
    }
}