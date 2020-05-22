import Delegate from "./delegate.js";
import { app, toolbox, socket, board } from "./app.js";

interface DragInfo{
    e : HTMLElement | null;
    dx : number;
    dy : number;
}

export class UI {
    onaction = new Delegate();

    dragInfo : DragInfo;

    constructor(){
        this.dragInfo = {e: null, dx: 0, dy: 0};
        document.addEventListener("DOMContentLoaded", () => {
            document.addEventListener("mousemove", (e) => {
                if(this.dragInfo && this.dragInfo.e){
                    let x = e.clientX - this.dragInfo.dx;
                    let y = e.clientY - this.dragInfo.dy;
                    if(x > 20 && this.dragInfo.e.clientWidth + x < window.innerWidth - 20)
                        this.dragInfo.e.style.left = `${x}px`;
                    if(y > 20 && this.dragInfo.e.clientHeight + y < window.innerHeight - 20)
                        this.dragInfo.e.style.top = `${y}px`;
                }
            });
            document.addEventListener("mouseup", (e) => {
                if(this.dragInfo){
                    this.dragInfo = {e: null, dx: 0, dy: 0};
                    app.setCursor("default");
                }
            });
            document.querySelectorAll("*[action]").forEach((e) => {
                e.addEventListener("click", () => {
                    let action = e.getAttribute("action");
                    if(action)
                        this.onaction.invoke(action, e);
                })
            });

            document.querySelectorAll(".panel .button").forEach((e) => {
                e.addEventListener("mousedown", () => {
                    e.classList.add("ripple");
                    setTimeout(() => {e.classList.remove("ripple")}, 500);
                });
            });

            document.querySelectorAll(".toolbar #grab").forEach((e) => {
                (e as HTMLElement).addEventListener("mousedown", (event) => {
                    if(e.parentElement){
                        let style = window.getComputedStyle(e.parentElement);
                        this.dragInfo = {
                            e: e.parentElement,
                            dx: event.clientX - parseInt(style.left),
                            dy: event.clientY - parseInt(style.top)
                        };
                        app.setCursor("move");
                    }
                });
            });

            document.querySelectorAll("#board-static-name").forEach((e) => {
                e.addEventListener("click", () => {
                    (e as HTMLElement).style.display = "none";
                    let input = document.querySelector("#board-name") as HTMLElement;
                    input.style.display = "block";
                    input.focus();
                    (input as HTMLInputElement).select();
                });
            });
            (document.querySelector("#board-name") as HTMLInputElement).addEventListener("blur", (e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
                let text = document.querySelector("#board-static-name") as HTMLElement;
                text.innerHTML = (e.currentTarget as HTMLInputElement).value;
                text.style.display = "block";
                board.name = text.innerHTML;
                socket.send("board:name", board.name);
            });
            (document.querySelector("#board-name") as HTMLInputElement).addEventListener("keydown", (e) => {
                if(e.keyCode != 13) return;
                (e.currentTarget as HTMLElement).style.display = "none";
                let text = document.querySelector("#board-static-name") as HTMLElement;
                text.innerHTML = (e.currentTarget as HTMLInputElement).value;
                text.style.display = "block";
                board.name = text.innerHTML;
                socket.send("board:name", board.name);
            });

            (document.querySelector("#stroke-size") as HTMLInputElement).addEventListener("change", (e) => {
                toolbox.weight = (e.currentTarget as HTMLInputElement).valueAsNumber;
            });
        });
    }

    setText(selector : string, text : string) {
        let e = document.querySelector(selector);
        if(e == null) return;
        e.innerHTML = text;
    }

    setActive(all : string, e : string) {
        document.querySelectorAll(all).forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(e).forEach((t) => t.classList.add("active"));
    }
}