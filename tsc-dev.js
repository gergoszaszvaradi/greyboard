const fs = require("fs");
const { exec, spawn } = require("child_process");
const colors = require('colors');

let buildTimer = null;
let stage = {
    nodejs: {},
    browser: {}
};
let building = false;
let runProcess = null;

function kill(pid){
    spawn("taskkill", ["/pid", pid, '/f', '/t']);
}

function buildAndRun(cmd, restart) {
    console.log(cmd);
    building = true;
    if(runProcess && restart) kill(runProcess.pid);
    exec(cmd, (error, stdout, stderr) => {
        building = false;
        if (error) {
            console.log(`error: ${error}`.red);
            console.log(stdout);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`.red);
            console.log(stdout);
            return;
        }
        console.log("build succeeded");
        if(restart){
            runProcess = spawn("npm", ["run", "start"], {shell: true});
            runProcess.stdout.on("data", data => console.log(data.toString()));
            runProcess.stderr.on("data", data => console.log(`STDERR: ${data}`.red));
            runProcess.on("error", error => console.log(`ERR: ${error.message}\n${error.stack}`.red));
            runProcess.on("close", code => console.log(`Process exited with code ${code}`.green));
        }
    });
}

buildAndRun("tsc -p tsconfig.nodejs.json && tsc -p tsconfig.browser.json", true);

let watcher = fs.watch("./", { recursive: true }, (e, f) => {
    if(!f.endsWith(".ts")) return;

    if(f.startsWith("public")){
        if(f in stage.browser)
            return;
        stage.browser[f] = true;
    }else{
        if(f in stage.nodejs)
            return;
        stage.nodejs[f] = true;
    }

    if(buildTimer)
        clearTimeout(buildTimer);

    if(building) return;
    
    buildTimer = setTimeout(() => {
        let restart = false;
        let cmd = "";
        let files = Object.keys(stage.nodejs);
        if(files.length > 0){
            cmd += "tsc --module commonjs --strict true --sourceMap false --target es6 --esModuleInterop true ";
            for(let k of files)
                cmd += k + " ";
            restart = true;
        }
        
        files = Object.keys(stage.browser);
        if(files.length > 0){
            if(cmd.length > 0)
                cmd += "&& ";
            cmd += "tsc --strict true --sourceMap false --target es6 --esModuleInterop true ";
            for(let k of files)
                cmd += k + " ";
        }

        buildAndRun(cmd, restart);

        stage.nodejs = {};
        stage.browser = {};
    }, 3000);
});

process.on("SIGINT", () => {
    if(runProcess) kill(runProcess.pid);
    watcher.close();
});