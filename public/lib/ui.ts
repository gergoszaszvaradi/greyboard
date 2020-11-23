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
        $(document).ready(() => {
            $(document).on("mousemove", (e) => {
                if(this.dragInfo && this.dragInfo.e){
                    let x = e.clientX - this.dragInfo.dx;
                    let y = e.clientY - this.dragInfo.dy;
                    if(x > 20 && this.dragInfo.e.clientWidth + x < window.innerWidth - 20)
                        this.dragInfo.e.style.left = `${x}px`;
                    if(y > 20 && this.dragInfo.e.clientHeight + y < window.innerHeight - 20)
                        this.dragInfo.e.style.top = `${y}px`;
                }
            });
            $(document).on("mouseup", (e) => {
                if(this.dragInfo){
                    this.dragInfo = {e: null, dx: 0, dy: 0};
                    app.setCursor("default");
                }
            });
            $(document).on("click", (e) => {
                if(e.target){
                    let action = $(e.target).attr("action");
                    if(action){
                        this.onaction.invoke(action, e.target);
                    }
                }
            });

            $("#board-static-name").on("click", (e) => {
                $(e.currentTarget).hide();
                let input = $("#board-name");
                input.show();
                input.focus();
                input.select();
            });
            $("#board-name").on("blur", (e) => {
                $(e.currentTarget).hide();
                let text = $("#board-static-name");
                text.text($(e.currentTarget).val() as string);
                text.show();
                board.name = text.text();
                document.title = `Greyboard | ${board.name}`;
                socket.send("board:name", board.name);
            });
            $("#board-name").on("keydown", (e) => {
                if(e.keyCode != 13) return;
                $(e.currentTarget).hide();
                let text = $("#board-static-name");
                text.text($(e.currentTarget).val() as string);
                text.show();
                board.name = text.text();
                document.title = `Greyboard | ${board.name}`;
                socket.send("board:name", board.name);
            });

            $("#stroke-size").on("change", (e) => {
                toolbox.weight = $(e.currentTarget).val() as number;
            });
        });
    }

    setText(selector : string, text : string) {
        $(selector).text(text);
    }

    setActive(all : string, e : string) {
        $(all).removeClass("active");
        $(e).addClass("active");
    }
}