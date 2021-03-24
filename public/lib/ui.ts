import Delegate from "./delegate.js";
import { app, toolbox, socket, board } from "./app.js";
import { IClient } from "./socket.js";
import Exporter from "./exporter.js";
import * as Util from "./util.js"

export class UI {
    onaction : Delegate = new Delegate();

    hintRemoved : boolean = false;
    inputFocused : boolean = false;

    constructor() {
        jQuery(() => {
            $(document).on("click", (e) => {
                if(e.target){
                    let action = $(e.target).data("action");
                    if(action)
                        this.onaction.invoke(action, e.target);
                }
            });

            $(document).on("mousedown wheel touchstart", () => this.removeStartingHint());
            $("input").on("focus", () => this.inputFocused = true);
            $("textarea").on("focus", () => this.inputFocused = true);
            $("input").on("blur", e => this.inputFocused = false);
            $("textarea").on("blur", e => this.inputFocused = false);

            $("#stroke-size").on("change", (e) => {
                toolbox.weight = $("#stroke-size").val() as number;
            });

            $("#board-static-name").on("click", () => {
                $("#board-static-name").hide();
                $("#board-name").show().focus().select();
            });
            $("#board-name").on("blur keydown", (e) => {
                if(e.type == "keydown" && e.key != "Enter") return;

                board.setName($("#board-name").val() as string);
                $("#board-static-name").show();
                $("#board-name").hide();
                socket.send("board:name", board.name);
            });

            $(".window-close-button").on("click", () => {
                this.hideWindows();
            });


            $("input[id^=\"export-padding\"]").on("change", () => {
                let padding = new Util.Rect(
                    parseInt($("#export-padding-left").val() as string),
                    parseInt($("#export-padding-top").val() as string),
                    parseInt($("#export-padding-right").val() as string),
                    parseInt($("#export-padding-bottom").val() as string)
                );
                let data = Exporter.getPreviewImageData(padding, 1);
                $(".export-preview img").attr("src", data);
            });
        });
    }

    addUserPresence(client : IClient) {
        let abr = client.name.replace(/[^A-Z]/g, "");
        $("#users").append(`<div class="toolbar-button" data-action="pan-to-user" data-user="${client.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${client.name}</div></div>`);
    }
    removeUserPresence(cid : string) {
        $(`.toolbar-button[data-user="${cid}"]`).remove();
    }
    setUserPresenceAFKState(cid : string, state : boolean) {
        if(state)
            $(`.toolbar-button[data-user="${cid}"]`).addClass("afk");
        else
            $(`.toolbar-button[data-user="${cid}"]`).removeClass("afk");
    }

    setToolbarButtonIcon(action : string, icon : string) {
        $(`.toolbar-button[data-action="${action}"] > i`).attr("class", `mdi ${icon}`);
    }
    setToolActive(tool : string) {
        $(".toolbar-button[data-action^=tool-]").removeClass("active");
        $(`.toolbar-button[data-action="tool-${tool}"]`).addClass("active");
    }
    setColorActive(color : string) {
        $(`.toolbar-button[data-action="set-color"]`).removeClass("active");
        $(`.toolbar-button[data-color="${color}"]`).addClass("active");
    }
    setZoomLevelPercentage(value : number) {
        $("#zoomlevel").text(`${Math.floor(value * 100)}%`);
    }

    setText(selector : string, text : string) {
        $(selector).text(text);
    }
    setTemporaryText(selector : string, text : string, time : number = 1000){
        let original = $(selector).text();
        $(selector).text(text);
        setTimeout(() => {
            $(selector).text(original);
        }, time);
    }

    removeStartingHint(){
        if(this.hintRemoved == false){
            $(".start-hint").fadeOut();
            this.hintRemoved = true;
        }
    }

    hideWindows() {
        $(".windows").fadeOut("fast");
    }
    showWindow(id : string) {
        $(".window").hide();
        $("#" + id).show();
        $(".windows").fadeIn("fast");
    }

    showExportWindow() {
        let padding = new Util.Rect(
            parseInt($("#export-padding-top").val() as string),
            parseInt($("#export-padding-right").val() as string),
            parseInt($("#export-padding-bottom").val() as string),
            parseInt($("#export-padding-left").val() as string)
        );
        let data = Exporter.getPreviewImageData(padding, 1);
        $(".export-preview img").attr("src", data);
        this.showWindow("export-window");
    }
}