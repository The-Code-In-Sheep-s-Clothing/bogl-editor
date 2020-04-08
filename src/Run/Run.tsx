import React, { useState, useEffect } from 'react';
// import Form from 'react-bootstrap/Form';
import Terminal from 'terminal-in-react';

// Class for representing requests
// that can be made to the Spiel Language Server
class SpielServerRequest {

    // Change to Backend API
    static SPIEL_API = "http://localhost:8080";


    // creates a new file with the given content
    // automatically adds '.bgl' to whatever the name is
    // so 'TEST' will be 'TEST.bgl' serverside
    // (to protect overwriting existing non-bgl files)
    static save(fileName,content) {
        return fetch(SpielServerRequest.SPIEL_API+'/save', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: fileName,
                content: content,
            }),
        });
    }

    static read(fileName) {
        return fetch(SpielServerRequest.SPIEL_API+'/read', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName
            }),
        });
    }


    // requests the test endpoint,
    // just to make sure things are working
    static test() {
        return fetch(
            SpielServerRequest.SPIEL_API+"/test", {
                method: "GET"
            });
    }


    // "examples/TicTacToe.bgl"
    // ["2 + 2","3 * 3","20 / 4"]
    // Runs a file with the given commands
    static runCmds(fileToUse, command, buf) {
        return fetch(SpielServerRequest.SPIEL_API+'/runCmds', {
            method: 'POST',
            //mode: 'no-cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: fileToUse,
                input: command,
                buffer: buf
            }),
        })
    }
}

// Global strings to keep React state consistent (probably not best practice)
let code = "";
let command = "";
let promptSymbol = ">";

const Run = (props) => {

    let [commandInput, setCommandInput] = useState(Array<any>());
    let [inputState, setInputState] = useState(false);
    
    code = props.code;

    // Used to parse response from back-end server
    function parse_response(responses: any) {
        console.log(responses);
        let latest: JSON = responses[responses.length-1];
        let res: string = "";
        switch (latest["tag"]) {
            // Basic value, just print
            case "SpielValue": {
                res = latest["contents"]["value"].toString();
                clear();
                break;
            }
            // Board value: Need to loop through board and build string
            case "SpielBoard": {
                let boardJSON: JSON = JSON.parse(latest["contents"]);
                let board: Array<Array<string>> = boardJSON["board"];
                for (let i: number = 0; i < board.length; i++) {
                    for (let j: number = 0; j < board[i].length; j++) {
                        if (j) {
                            res += "\t";
                        }
                        res += board[i][j];
                    }
                    res += "\n";
                }
                clear();
                break;
            }
            // Need to build board (same as spielboard), also switch to input
            // mode since expects input
            case "SpielPrompt": {
                let boardJSON: JSON = latest["contents"];
                //console.log("boardJSON: ", boardJSON);
                let board: Array<Array<JSON>> = boardJSON[0]["value"];
                //console.log("board: ", board);
                for (let i: number = 0; i < board.length; i++) {
                    for (let j: number = 0; j < board[i].length; j++) {
                        if (j) {
                            res += "\t";
                        }
                        res += board[i][j][1]["value"];
                    }
                    res += "\n";
                }
                if (!inputState) {
                    res += "Switching to input mode. Submit \"clear\" command to return to command mode.\n";
                    promptSymbol = ">>>";
                    inputState = true;
                }
                break;
            }
            // Errors
            case "SpielTypeError": {
                let contents = latest["contents"];

                // unused vars but I left them here in case we want to highlight in the editor
                let line = contents["line"];
                let column = contents["col"];
                // print(contents["message"]);
                clear();
                break;
            }
            // 
            case "SpielParseError": {
                res = latest["tag"] + ": " + latest["contents"];
                clear();
                break; 
            }
            // Error most likely
            default: {
                res = latest["tag"] + ": " + latest["contents"];
                clear();
                break;  
            }
        }
        console.log("FOUND: " + res);
        return res;
    }

    // Pushes item to command's input
    function input(next: string) {
        commandInput.push({"input":next});
        return;
    }

    // Sends execute command with input to back-end, then prints out using "print"
    // function to REPL terminal
    function executeCommand(cmd: string, print: any) {
        console.log("EXECUTING: " + cmd + "/" + command);
        console.log((cmd === "" ? command : cmd).toString());
        console.log(commandInput);
        SpielServerRequest.runCmds(props.filename, (cmd === "" ? command : cmd), commandInput)
        .then(res => res.json())
        .then((result) => {
            print(parse_response(result));
        }).catch((error) => {
            console.log("ERROR"); 
            print("Error:" + error);
        });
    }

    // Run REPL command. If expecting input, put input in
    function runCommand(cmd: string, print: any) {
        if (inputState) {
            input(cmd);
            return executeCommand("", print);
        } else {
            command = cmd;
            return executeCommand(cmd, print);
        }
    }

    // Clear input and state
    function clear() {
        setCommandInput([]);
        setInputState(false);
        command = "";
        //console.log(command);
        return "Exiting input mode.";
    }

    function getPromptSymbol() {
        console.log(promptSymbol);
        return promptSymbol.toString();
    }

    return (
        <Terminal
            color='white'
            backgroundColor='black'
            barColor='black'
            style={{ fontSize: "1.1em" }}
            showActions={false}
            commands={{
                "clear": () => clear(),
            }}
            commandPassThrough={(cmd, print) => {
                // Build command (cmd == array of arguments user entered with spaces separated)
                let c = "";
                for (var x = 0; x < cmd.length; x++) {
                    if (x) {
                        c += " ";
                    }
                    c += cmd[x];
                }
                if (c === "clear") {
                    return;
                }
                runCommand(c, print);
            }}
            allowTabs={false}
            hideTopBar={true}
            startState={"maximised"}
            promptSymbol={getPromptSymbol()}
        />

    )

}

export {Run,SpielServerRequest};
