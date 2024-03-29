import express from "express";
import http from "http";
import fileUpload from "express-fileupload";
import { GreyBoard } from "./greyboard.js";
const PORT = process.env.PORT || 5000;

let app  = express();
let server = http.createServer(app);
let greyboard : GreyBoard;

app.use(express.static("public"));
app.set("views", "public");
app.set("view engine", "ejs");
app.use(fileUpload({
    safeFileNames: true,
    useTempFiles : true,
    tempFileDir : './tmp/',
    limits: { fileSize: 10000000 },
    abortOnLimit: true
}));

app.get("/", (req : express.Request, res : express.Response) => {
    let publicBoards = greyboard.getPublicBoards();
    res.render("index", {publicBoards});
});

app.get("/new", (req : express.Request, res : express.Response) => {
    let id = greyboard.createBoard();
    res.statusCode = 307;
    res.redirect(`/b/${id}`);
    res.end();
});

app.post("/load", (req : express.Request, res : express.Response) => {
    console.log("REQUEST: " + req.files);
    // @ts-ignore
    greyboard.loadFromFile(req.files.file.tempFilePath, (err : Error | null, bid : string) => {
        if(err){
            res.send(err.message);
            res.end();
            return;
        }
        res.send(bid);
        res.end();
    });
});

app.get("/b/:id", (req : express.Request, res : express.Response) => {
    if(greyboard.boardExists(req.params.id)){
        res.render("board", {board: { id: req.params.id, name: "New Board"} });
    }else{
        let publicBoards = greyboard.getPublicBoards();
        res.render("board404", {publicBoards});
    }
    res.end();
});

app.get("/b/:id/save", (req : express.Request, res : express.Response) => {
    if(greyboard.boardExists(req.params.id)){
        res.setHeader('Content-disposition', `attachment; filename=board_${req.params.id}.gb`);
        res.setHeader('Content-Type', 'text/plain');
        greyboard.writeToResponse(res, req.params.id);
    }else{
        res.send("Board does not exist");
    }
    res.end();
});

server.listen(PORT);
server.on("listening", () => {
    console.log("Listening on " + PORT);

    greyboard = new GreyBoard(server);
});