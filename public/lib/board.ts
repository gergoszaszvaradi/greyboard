import * as Util from "./util.js"
import { viewport, app, socket, toolbox, board } from "./app.js";
import { ActionStack } from "./action.js";
import Delegate from "./delegate.js";

export enum BoardItemType{
    None = 0,
    Path = 1,
    Rectangle = 2,
    Ellipse = 3,
    Arrow = 4,
    Image = 5
};

export class Board {
    name : string = "New board";
    items : {[key : string] : BoardItem} = {};

    add(items : Array<BoardItem>){ 
        for(let item of items)
            this.items[item.id] = item;
    }

    addFromObjects(objs : Array<any>) {
        console.log(objs);
        let itemsToAdd : Array<BoardItem> = [];
        for(let item of objs){
            if(item.type == BoardItemType.Path){
                let path = new BoardPath(item.cid, item.points, item.color, item.weight);
                path.id = item.id;
                path.rect = item.rect;
                itemsToAdd.push(path);
            }else if(item.type == BoardItemType.Rectangle){
                let rectangle = new BoardRectangle(item.cid, item.rect.x, item.rect.y, item.rect.w, item.rect.h, item.color, item.weight, item.filled);
                rectangle.id = item.id;
                itemsToAdd.push(rectangle);
            }else if(item.type == BoardItemType.Ellipse){
                let ellipse = new BoardEllipse(item.cid, item.rect.x, item.rect.y, item.rect.w, item.rect.h, item.color, item.weight, item.filled);
                ellipse.id = item.id;
                itemsToAdd.push(ellipse);
            }else if(item.type == BoardItemType.Arrow){
                let arrow = new BoardArrow(item.cid, item.start.x, item.start.y, item.end.x, item.end.y, item.color, item.weight);
                arrow.id = item.id;
                arrow.rect = item.rect;
                itemsToAdd.push(arrow);
            }else if(item.type == BoardItemType.Image){
                console.log(item.rect);
                let img = new BoardImage(item.cid, item.rect.x, item.rect.y, item.src);
                img.id = item.id;
                img.onloaded.add(() => {
                    img.rect.w = item.rect.w;
                    img.rect.h = item.rect.h;
                });
                itemsToAdd.push(img);
            }
        }
        this.add(itemsToAdd);
    }

    addFromClipboard(data : DataTransfer){
        if(data == null) return;
        if(data.items.length == 0) return;
        let item = data.items[0];
        if(item.type.startsWith("text")){
            let items = JSON.parse(data.getData("text"));
            if(items){
                toolbox.selectTool(toolbox.select);
                toolbox.select.clearSelection();
                let ids = [];
                for(let i of items){
                    i.id = Util.generateID();
                    i.rect.x += 30;
                    i.rect.y += 30;
                    ids.push(i.id);
                }
                navigator.clipboard.writeText(JSON.stringify(items));

                ActionStack.add((data) => {
                    this.addFromObjects(data.items);
                    toolbox.select.selection = data.ids;
                    toolbox.select.calculateBoundingBox();
                    socket.send("board:add", data.items);
                }, (data) => {
                    this.remove(data.ids);
                    socket.send("board:remove", data.ids);
                }, {items, ids});

                board.addFromObjects(items);
                toolbox.select.selection = ids;
                toolbox.select.calculateBoundingBox();
            }
        }else if(item.type.startsWith("image")){
            let blob = item.getAsFile();
            Util.toDataURL(Util.toUrlObj(blob), (b64) => {
                let topleft = viewport.screenToViewport(0, 0);
                let bottomright = viewport.screenToViewport(window.innerWidth, window.innerHeight);
                let img = new BoardImage(socket.cid, (topleft.x + bottomright.x) / 2, (topleft.y + bottomright.y) / 2, b64 as string);
                img.onloaded.add(() => {
                    ActionStack.add((data) => {
                        this.add([img]);
                        socket.send("board:add", [img]);
                    }, (data) => {
                        this.remove([img.id]);
                        socket.send("board:remove", [img.id]);
                    }, img);
                });
            });
        }
    }

    move(ids : Array<string>, dx : number, dy : number){
        for(let id of ids){
            let item = this.items[id];
            item.rect.x -= dx;
            item.rect.y -= dy;
        }
    }
    scale(ids : Array<string>, dx : number, dy : number){
        let bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
        for(let i of ids){
            let item = this.items[i];
            if(item.rect.x < bb.x) bb.x = item.rect.x;
            if(item.rect.x + item.rect.w > bb.w) bb.w = item.rect.x + item.rect.w;
            if(item.rect.y < bb.y) bb.y = item.rect.y;
            if(item.rect.y + item.rect.h > bb.h) bb.h = item.rect.y + item.rect.h;
        }
        bb.w -= bb.x;
        bb.h -= bb.y;

        for(let id of ids){
            let item = this.items[id];
            item.rect.x -= ((item.rect.x - bb.x) / bb.w) * dx;
            item.rect.y -= ((item.rect.y - bb.y) / bb.h) * dy;
            item.rect.w -= (item.rect.w / bb.w) * dx;
            item.rect.h -= (item.rect.h / bb.h) * dy;
        }
    }

    remove(ids : Array<string>){
        for(let id of ids)
            delete this.items[id];
    }

    clear(){
        for(let id in this.items){
            delete this.items[id];
        }
    }

    each(func : (item : BoardItem) => void){
        for(let item in this.items)
            func(this.items[item]);
    }

    draw(){
        for(let i in this.items)
            if(viewport.isRectInView(this.items[i].rect))
                this.items[i].draw();
    }
}

export class BoardItem {
    id : string;
    cid : string;
    rect : Util.Rect;
    type : BoardItemType;

    constructor(cid : string, x : number = 0, y : number = 0, w : number = 0, h : number = 0) {
        this.cid = cid;
        this.rect = new Util.Rect(x, y, w, h);
        this.id = Util.generateID();
        this.type = BoardItemType.None;
    }

    isInRect(rect : Util.Rect) : boolean { return false; };
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number) : boolean { return false; };

    draw(){};
}

export class BoardPath extends BoardItem {
    points : Array<Util.Point>;
    color : string = "#ffffff";
    weight : number = 2;

    constructor(cid : string, points : Array<Util.Point>, color : string, weight : number){
        super(cid);
        this.points = points;
        this.color = color;
        this.weight = weight;
        this.type = BoardItemType.Path;
        this.rect.x = Infinity;
        this.rect.y = Infinity;
        this.rect.w = -Infinity;
        this.rect.h = -Infinity;
    }

    normalize(){
        for(let point of this.points){
            point.x = (point.x - this.rect.x) / this.rect.w;
            point.y = (point.y - this.rect.y) / this.rect.h;
        }
    }

    optimize(){
        for(let i = this.points.length-2; i >= 2; i--){
            let next = this.points[i];
            let curr = this.points[i-1];
            let prev = this.points[i-2];
            let dist = (next.x - prev.x) * (next.x - prev.x) + (next.y - prev.y) * (next.y - prev.y);
            if(dist > 9){
                let a1 = Util.angle(prev.x, prev.y, curr.x, curr.y);
                let a2 = Util.angle(curr.x, curr.y, next.x, next.y);
                if(Math.abs(a1-a2) < 3){
                    this.points.splice(i-1, 1);
                }
            }
        }
    }

    calculateRect(){
        for(let point of this.points){
            if(point.x < this.rect.x) this.rect.x = point.x;
            if(point.x > this.rect.w) this.rect.w = point.x;
            if(point.y < this.rect.y) this.rect.y = point.y;
            if(point.y > this.rect.h) this.rect.h = point.y;
        }
        this.rect.w -= this.rect.x;
        this.rect.h -= this.rect.y;
        if(this.rect.w == 0) this.rect.w = 1;
        if(this.rect.h == 0) this.rect.h = 1;
    }

    isInRect(rect : Util.Rect){
        for(let p of this.points){
            if(Util.isPointInRect(p.x * this.rect.w + this.rect.x, p.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h)){
                return true;
            }
        }
        return false;
    }
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number){
        for(let i = 1; i < this.points.length; i++){
            if(Util.lineIntersection(x1, y1, x2, y2, this.points[i].x * this.rect.w + this.rect.x, this.points[i].y * this.rect.h + this.rect.y, this.points[i-1].x * this.rect.w + this.rect.x, this.points[i-1].y * this.rect.h + this.rect.y)){
                return true;
            }
        }
        return false;
    }

    draw(){
        app.graphics.stroke(this.color, this.weight);
        app.graphics.path(this.points, this.rect);
    }
}

export class BoardRectangle extends BoardItem {
    color : string = "#ffffff";
    weight : number = 2;
    filled : boolean;

    constructor(cid : string, x : number, y : number, w : number, h : number, color : string, weight : number, filled : boolean = false) {
        super(cid, x, y, w, h);
        this.color = color;
        this.weight = weight;
        this.filled = filled;
        this.type = BoardItemType.Rectangle;
    }

    isInRect(rect : Util.Rect) : boolean {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number) : boolean {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }

    draw(){
        if(this.filled){
            app.graphics.fill(this.color);
            app.graphics.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        }else{
            app.graphics.stroke(this.color, this.weight);
            app.graphics.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        }
    }
}

export class BoardEllipse extends BoardItem {
    color : string = "#ffffff";
    weight : number = 2;
    filled : boolean;

    constructor(cid : string, x : number, y : number, w : number, h : number, color : string, weight : number, filled : boolean = false) {
        super(cid, x, y, w, h);
        this.color = color;
        this.weight = weight;
        this.filled = filled;
        this.type = BoardItemType.Ellipse;
    }

    isInRect(rect : Util.Rect) : boolean {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number) : boolean {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }

    draw(){
        if(this.filled){
            app.graphics.fill(this.color);
            app.graphics.fillEllipse(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2, this.rect.w / 2, this.rect.h / 2);
        }else{
            app.graphics.stroke(this.color, this.weight);
            app.graphics.ellipse(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2, this.rect.w / 2, this.rect.h / 2);
        }
    }
}

export class BoardImage extends BoardItem {
    img : CanvasImageSource;
    src : string;
    loaded : boolean = false;
    onloaded = new Delegate();

    constructor(cid : string, x : number = 0, y : number = 0, src : string) {
        super(cid, x, y, 0, 0);
        this.img = new Image();
        this.src = src;
        this.img.src = src;
        this.img.onload = () => {
            this.rect.w = this.img.width as number;
            this.rect.h = this.img.height as number;
            this.loaded = true;
            this.onloaded.invoke();
        }
        this.type = BoardItemType.Image;
    }

    isInRect(rect : Util.Rect) : boolean {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number) : boolean {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }

    draw(){
        if(!this.loaded) return;

        app.graphics.img(this.rect.x, this.rect.y, this.rect.w, this.rect.h, this.img);
    }
}

export class BoardArrow extends BoardItem{
    start : Util.Point;
    end : Util.Point;
    color : string = "#ffffff";
    weight : number = 2;

    constructor(cid : string, x1 : number = 0, y1 : number = 0, x2 : number = 0, y2 : number = 0, color : string, weight : number) {
        super(cid, x1, y1, x2 - x1, y2 - y1);
        this.start = new Util.Point(x1, y1);
        this.end = new Util.Point(x2, y2);
        this.color = color;
        this.weight = weight;
        this.type = BoardItemType.Arrow;
    }

    normalize(){
        this.start = new Util.Point((this.start.x - this.rect.x) / this.rect.w, (this.start.y - this.rect.y) / this.rect.h);
        this.end = new Util.Point((this.end.x - this.rect.x) / this.rect.w, (this.end.y - this.rect.y) / this.rect.h);
    }

    calculateRect(){
        console.log(this.start, this.end);
        this.rect.x = (this.start.x < this.end.x) ? this.start.x : this.end.x;
        this.rect.w = Math.abs(this.end.x - this.start.x);
        this.rect.y = (this.start.y < this.end.y) ? this.start.y : this.end.y;
        this.rect.h = Math.abs(this.end.y - this.start.y);
    }

    isInRect(rect : Util.Rect) : boolean {
        return (Util.isPointInRect(this.start.x * this.rect.w + this.rect.x, this.start.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h) ||
                Util.isPointInRect(this.end.x * this.rect.w + this.rect.x, this.end.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h));
    }
    isInLine(x1 : number, y1 : number, x2 : number, y2 : number) : boolean {
        return Util.lineIntersection(this.start.x * this.rect.w + this.rect.x, this.start.y * this.rect.h + this.rect.y, this.end.x * this.rect.w + this.rect.x, this.end.y * this.rect.h + this.rect.y, x1, y1, x2, y2);
    }

    draw(){
        let sx = this.start.x * this.rect.w + this.rect.x;
        let sy = this.start.y * this.rect.h + this.rect.y;
        let ex = this.end.x * this.rect.w + this.rect.x;
        let ey = this.end.y * this.rect.h + this.rect.y;

        app.graphics.stroke(this.color, this.weight);
        app.graphics.line(sx, sy, ex, ey);

        app.graphics.fill(this.color);
        let angle = Math.atan2(ey - sy, ex - sx);
        let triangle : Array<Util.Point> = [];
        for(let a = 0; a < Math.PI*2; a += (Math.PI*2)/3){
            let x = Math.cos(a + angle) * this.weight;
            let y = Math.sin(a + angle) * this.weight;
            triangle.push(new Util.Point(ex + x, ey + y));
        }
        app.graphics.polygon(triangle);
    };
}