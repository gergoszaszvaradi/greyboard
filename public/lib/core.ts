import Delegate from "./delegate.js"
import Graphics from "./graphics.js";
import { UI } from "./ui.js";
import * as Util from "./util.js"

export class Mouse {
    x : number = 0;
    y : number = 0;
    px : number = 0;
    py : number = 0;
    dx : number = 0;
    dy : number = 0;
    button : number = -1;
    pressed : boolean = false;
}

export class TouchPosition {
    x : number = 0;
    y : number = 0;
    px : number = 0;
    py : number = 0;
    constructor(x : number, y : number) {
        this.x = x;
        this.y = y;
        this.px = x;
        this.py = y;
    }
}
export class Pointer {
    x : number = 0;
    y : number = 0;
    px : number = 0;
    py : number = 0;
    cx : number = 0;
    cy : number = 0;
    button : number = -1;
    pressed : boolean = false;
    isTouch : boolean = false;
    touches : Array<TouchPosition> = [];
}

export class Keyboard {
    private keys : Map<number, boolean>;
    private pressedKeyCount : number;

    constructor(){
        this.keys = new Map();
        this.pressedKeyCount = 0;
    }

    public setKeyState(key : number, state : boolean) {
        this.keys.set(key, state);
    }

    public isPressed(key : number) : boolean {
        return this.keys.get(key) == true;
    }

    public arePressed(keys : number[]) : boolean {
        for(let v of keys){
            if(this.keys.get(v) == true)
                return true;
        }
        return false;
    }

    public isAnyPressed() : boolean {
        for(let v of this.keys){
            if(v[1] == true)
                return true;
        }
        return false;
    }
}

export interface Shortcut{
    key : number;
    ctrl : boolean;
    shift : boolean;
    alt : boolean;
    callback : (...args : any[]) => void;
}

export class Application {
    graphics : Graphics;

    width: number = 0;
    height: number = 0;
    pointer = new Pointer();
    keyboard = new Keyboard();
    shortcuts : Array<Shortcut> = [];

    onresize = new Delegate();
    onpointerdown = new Delegate();
    onpointermove = new Delegate();
    onpointerup = new Delegate();
    onpointerpinch = new Delegate();
    onmousewheel = new Delegate();
    onkeydown = new Delegate();
    onkeyup = new Delegate();

    oncopy = new Delegate();
    onpaste = new Delegate();

    onupdate = new Delegate();
    onfocuschanged = new Delegate();
    lastUpdateTime : number;

    ui = new UI();

    constructor(){
        let canvas = document.getElementById("canvas");
        this.graphics = new Graphics(canvas as HTMLCanvasElement);
        //@ts-ignore
        createjs.Ticker.timingMode = createjs.Ticker.RAF;

        this.resize(window.innerWidth, window.innerHeight);

        window.addEventListener("resize", () => {
            this.resize(window.innerWidth, window.innerHeight);

            this.onresize.invoke(this.width, this.height);
        });
        window.addEventListener("keydown", (e) => {
            this.keyboard.setKeyState(e.keyCode, true);
            this.onkeydown.invoke(e.keyCode, e.ctrlKey, e.shiftKey, e.altKey);
        });
        window.addEventListener("keyup", (e) => {
            if(!this.ui.inputFocused)
                for(let shortcut of this.shortcuts)
                    if(e.ctrlKey == shortcut.ctrl && e.shiftKey == shortcut.shift && e.altKey == shortcut.alt && e.keyCode == shortcut.key)
                        shortcut.callback();
                
            this.keyboard.setKeyState(e.keyCode, false);
            this.onkeyup.invoke(e.keyCode, e.ctrlKey, e.shiftKey, e.altKey);
        });
        window.addEventListener("copy", (e) => {
            this.oncopy.invoke((e as ClipboardEvent).clipboardData);
        });
        window.addEventListener("paste", (e) => {
            this.onpaste.invoke((e as ClipboardEvent).clipboardData);
        });
        window.addEventListener("focus", (e) => {
            this.onfocuschanged.invoke(true);
        });
        window.addEventListener("blur", (e) => {
            this.onfocuschanged.invoke(false);
        });

        const onPointerDown = (x : number, y : number, button : number, touches : TouchList | Touch[]) => {
            this.pointer.px = this.pointer.x = x;
            this.pointer.py = this.pointer.y = y;
            this.pointer.button = button;
            this.pointer.pressed = true;
            this.pointer.isTouch = touches.length > 0;
            for(let t of touches){
                this.pointer.touches.push(new TouchPosition(t.clientX, t.clientY));
            }
            this.onpointerdown.invoke(button, x, y);
        }
        this.graphics.canvas.addEventListener("mousedown", (e) => onPointerDown(e.clientX, e.clientY, e.button, []));
        this.graphics.canvas.addEventListener("touchstart", (e) => onPointerDown(e.touches[0].clientX, e.touches[0].clientY, 0, e.touches));

        const onPointerMove = (x : number, y : number, touches : TouchList | Touch[]) => {
            this.pointer.px = this.pointer.x;
            this.pointer.py = this.pointer.y;
            this.pointer.x = this.pointer.cx = x;
            this.pointer.y = this.pointer.cy = y;
            if(this.pointer.touches.length == 0)
                for(let t of touches)
                    this.pointer.touches.push(new TouchPosition(t.clientX, t.clientY));

            for(let i = 0; i < touches.length; i++){
                this.pointer.touches[i].px = this.pointer.touches[i].x;
                this.pointer.touches[i].py = this.pointer.touches[i].y;
                this.pointer.touches[i].x = touches[i].clientX;
                this.pointer.touches[i].y = touches[i].clientY;
            }
            if(touches.length > 1) {
                this.pointer.button = 1;

                let d = Util.dist(this.pointer.touches[0].x, this.pointer.touches[0].y, this.pointer.touches[1].x, this.pointer.touches[1].y);
                let pd = Util.dist(this.pointer.touches[0].px, this.pointer.touches[0].py, this.pointer.touches[1].px, this.pointer.touches[1].py);
                this.pointer.cx = (this.pointer.touches[0].x + this.pointer.touches[1].x) / 2;
                this.pointer.cy = (this.pointer.touches[0].y + this.pointer.touches[1].y) / 2;
                if(d != 0 && pd != 0 && d != pd)
                    this.onpointerpinch.invoke(d / pd);
            }
            this.onpointermove.invoke(x, y);
        };
        this.graphics.canvas.addEventListener("mousemove", (e) => onPointerMove(e.clientX, e.clientY, []));
        this.graphics.canvas.addEventListener("touchmove", (e) => onPointerMove(e.touches[0].clientX, e.touches[0].clientY, e.touches));

        const onPointerUp = (x : number, y : number, touches : TouchList | Touch[]) => {
            this.pointer.pressed = false;
            this.pointer.button = -1;
            this.pointer.touches = [];
            // for(let t of touches){
            //     this.pointer.touches.push(new TouchPosition(t.clientX, t.clientY));
            // }
            this.onpointerup.invoke(x, y);
        }
        this.graphics.canvas.addEventListener("mouseup", (e) => onPointerUp(e.clientX, e.clientY, []));
        this.graphics.canvas.addEventListener("touchend", (e) => onPointerUp(this.pointer.x, this.pointer.y, e.touches));

        this.graphics.canvas.addEventListener("wheel", (e) => {
            this.onmousewheel.invoke(e.deltaX, e.deltaY);
        });

        this.lastUpdateTime = (new Date()).getTime();
        this.update();
    }

    resize(w : number, h : number) {
        this.width = w;
        this.height = h;
        this.graphics.resize(w, h);
    }

    update(){
        window.requestAnimationFrame(() => {
            let now = (new Date()).getTime();
            let ts = (now - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = now;
            this.onupdate.invoke(ts);
            this.update();
        });
    }

    registerShortcut(key : number, ctrl : boolean, shift : boolean, alt : boolean, callback : (...args : any[]) => void) {
        this.shortcuts.push({key, ctrl, shift, alt, callback});
    }

    setCursor(cursor : string) {
        document.body.style.cursor = cursor;
    }
} 