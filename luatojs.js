/*
Converts lua to js

TODO:
Standard library

Comments, whitespace after lastnode

Typedarrays for strings?

Metatables: Proxy, Reflect or (compile?)

GetFirstValue

JS Interop (calling js functions and using js types from lua)

Figure out using unpack like f(unpack(t))
- use f.apply? spread syntax?

Frontend:
    Mappings for each character
    AST Displayer
    Input box, live output
*/

var parser = luaparse;


// var parser = require('luaparse');



// // https://www.geeksforgeeks.org/node-js-fs-readfilesync-method/
// const fs = require('fs');
// var infile = './in.lua';
// // infile = './tests/donut/in_f.lua';
// var outfile = './out.js';

// // frontend test compile
// infile = './frontend_test/script.lua';
// outfile = './frontend_test/script.js';


// var runtimefile = './runtime.js'
// // var runtimefile = './runtime_min.js'
// var CODE = fs.readFileSync(infile, {encoding: 'utf8', flag: 'r'});




window.luatojs = function(CODE) {

var options = {
    scope: true,
    // locations: true,
    ranges: true,
    luaVersion: 'LuaJIT',
};

// 1. Generate AST
var ast = parser.parse(CODE, options);
// console.log(JSON.stringify(ast, null, 2));


// 2. Generate a list of all comments
var comments = [];
function r(node) {
    for (let k in node) {
        let v = node[k];
        if (typeof v == 'object' && v != null) {
            if (v.type == 'Comment') {
                comments.push(v);
            }
            r(v);
        }
    }
}
r(ast);


// 3. AST to JS
var out = '';


// 3.1. Declare all globals at the top
let definedGlobals = []; // Exclude already defined globals
function listGlobals() {
    return Object.getOwnPropertyNames(this);
}
let g = listGlobals()
for (let i = 0; i < g.length; i++) {
    definedGlobals.push(g[i]);
}
let definedGlobalsMap = {};
for (let i = 0; i < definedGlobals.length; i++) {
    definedGlobalsMap[definedGlobals[i]] = true;
}

if (ast.globals.length != 0) {
    let empty = true;
    // out += 'var ';
    for (let i = 0; i < ast.globals.length; i++) {
        let c = ast.globals[i];
        if (!definedGlobalsMap[c.name]) {
            if (empty) {
                out += 'var ';
                empty = false;
            }
            // out += c.name + '=' + c.name + '?' + c.name + ':undefined';
            out += c.name;
            if (i != ast.globals.length - 1) {
                out += ',';
            }
        }
    }
    if (!empty) {
        out += ';'
    }
}


// 3.2. Recurse on AST
var lastNode;
var localsUsed;
function recurse(node, isList) {
    // scopeIndex++;
    // scopes.push(structuredClone(scopes[scopes.length - 1]));
    if (isList) {
        for (let i = 0; i < node.length; i++) {
            recurse(node[i]);
        }
    } else {
        // Comments
        // TODO: BETWEEN TOKENS
        /*
        let removeList = [];
        for (let i = 0; i < comments.length; i++) {
            let comment = comments[i];
            if ((!lastNode && comment.range[1] <= node.range[0]) || lastNode && (lastNode.range[0] < comment.range[0] && comment.range[1] < node.range[1])) {
                // Insert comment
                recurse(comment);
                removeList.push(i);
            }
        }
        for (let i = removeList.length - 1; i > -1; i--) {
            comments.splice(removeList[i], 1);
        }
        // */

        // Whitespace (using locations and range)




        let lastLastNode = lastNode; // last node from current node

        lastNode = node; // setting last node to current node

        switch (node.type) {
            case 'LabelStatement':
                console.log('ERROR: TODO');
                break;
            case 'BreakStatement':
                out += 'break;';
                break;
            case 'GotoStatement':
                console.log('ERROR: TODO');
                break;
            case 'ReturnStatement':
                if (node.arguments.length == 0) {
                    out += 'return;';
                } else {
                    if (node.arguments.length == 1) {
                        out += 'return ';
                        recurse(node.arguments[0]);
                    } else {
                        out += 'return['
                        for (let i = 0; i < node.arguments.length; i++) {
                            recurse(node.arguments[i]);
                            if (i != node.arguments.length - 1) {
                                out += ',';
                            }
                        }
                        out += ']'
                    }
                    out += ';';
                }
                break;
            case 'IfStatement':
                recurse(node.clauses, true);
                break;
            case 'IfClause':
                out += 'if(RuntimeInternal.isTrue(';
                recurse(node.condition);
                out += ')){';
                recurse(node.body, true);
                out += '}';
                break;
            case 'ElseifClause':
                out += 'else if(RuntimeInternal.isTrue(';
                recurse(node.condition);
                out += ')){';
                recurse(node.body, true);
                out += '}';
                break;
            case 'ElseClause':
                out += 'else{';
                recurse(node.body, true);
                out += '}';
                break;
            case 'WhileStatement':
                out += 'while(RuntimeInternal.isTrue(';
                recurse(node.condition);
                out += ')){';
                recurse(node.body, true);
                out += '}';
                break;
            case 'DoStatement':
                out += '{';
                recurse(node.body, true);
                out += '}';
                break;
            case 'RepeatStatement':
                out += 'do{';
                recurse(node.body, true);
                out += '}while(RuntimeInternal.isTrue('; 
                recurse(node.condition);
                out += '));';
                break;
            case 'LocalStatement':
                let noLocalList = [];
                let empty = true;
                // out += 'let ';
                for (let i = 0; i < node.variables.length; i++) {
                    // TODO: ADD MORE CALL STATEMENT TYPES
                    if (i < node.init.length && (node.init[i].type == 'CallExpression') && (i + 1 == node.init.length && node.variables.length >= i + 1)) {
                        // function call
                        let noLocalsUsed = true;
                        for (let i2 = i; i2 < node.variables.length; i2++) {
                            if (localsUsed[node.variables[i2].name] && i2 < node.init.length) {
                                noLocalsUsed = false;
                                // noLocalList.push(node.variables[i2]);
                            }
                        }

                        let ambiguous = node.variables.length - 1 == i;
                        if (noLocalsUsed) {
                            if (empty) {
                                out += 'let';
                                empty = false;
                                if (ambiguous) {
                                    out += ' ';
                                }
                            }
                            if (ambiguous) {
                                recurse(node.variables[i]);
                                out += '=RuntimeInternal.wrapAmbiguousCall(';
                                recurse(node.init[i]);
                                out += ')';
                            } else {
                                out += '[';
                                for (let i2 = i; i2 < node.variables.length; i2++) {
                                    recurse(node.variables[i2]);
                                    if (i2 != node.variables.length - 1) {
                                        out += ',';
                                    }
                                }
                                out += ']=';
                                recurse(node.init[i]);
                            }
                            break;
                        } else {
                            if (noLocalList.length > 0) {
                                if (!empty) {
                                    out += ';';
                                    empty = false;
                                }
                                for (let i = 0; i < noLocalList.length; i++) {
                                    let i2 = noLocalList[i];
                                    recurse(node.variables[i2]);
                                    if (i < node.init.length) {
                                        out += '=';
                                        recurse(node.init[i2]);
                                    }
                                    out += ',';
                                }
                            }
                            noLocalList = [];

                            if (ambiguous) {
                                recurse(node.variables[i]);
                                out += '=RuntimeInternal.wrapAmbiguousCall(';
                                recurse(node.init[i]);
                                out += ')';
                            } else {
                                out += '[';
                                for (let i2 = i; i2 < node.variables.length; i2++) {
                                    recurse(node.variables[i2]);
                                    if (i2 != node.variables.length - 1) {
                                        out += ',';
                                    }
                                }
                                out += ']=';
                                recurse(node.init[i]);
                            }
                            out += ';'
                            break;
                        }
                    } else if (i < node.init.length && (node.init[i].type == 'VarargLiteral') && (i + 1 == node.init.length && node.variables.length >= i + 1)) {
                        // vararg
                        // RuntimeInternal_VARARG
                        let noLocalsUsed = true;
                        for (let i2 = i; i2 < node.variables.length; i2++) {
                            if (localsUsed[node.variables[i2].name] && i2 < node.init.length) {
                                noLocalsUsed = false;
                                // noLocalList.push(node.variables[i2]);
                            }
                        }

                        if (noLocalsUsed) {
                            if (empty) {
                                out += 'let';
                                empty = false;
                            } else {
                                out += ',';
                            }
                            out += '[';
                            for (let i2 = i; i2 < node.variables.length; i2++) {
                                recurse(node.variables[i2]);
                                if (i2 != node.variables.length - 1) {
                                    out += ',';
                                }
                            }
                            out += ']=';
                            recurse(node.init[i]);
                            break;
                        } else {
                            if (noLocalList.length > 0) {
                                if (!empty) {
                                    out += ';';
                                    empty = false;
                                }
                                for (let i = 0; i < noLocalList.length; i++) {
                                    recurse(noLocalList[i]);
                                    if (i < node.init.length) {
                                        out += '=';
                                        recurse(node.init[i]);
                                    }
                                    out += ',';
                                }
                            }
                            noLocalList = [];

                            out += '[';
                            for (let i2 = i; i2 < node.variables.length; i2++) {
                                recurse(node.variables[i2]);
                                if (i2 != node.variables.length - 1) {
                                    out += ',';
                                }
                            }
                            out += ']=';
                            recurse(node.init[i]);
                            out += ';'
                            break;
                        }
                    } else {
                        // normal
                        if (localsUsed[node.variables[i].name] && i < node.init.length) {
                            // noLocalList.push(node.variables[i]);
                            noLocalList.push(i);
                        } else {
                            if (empty) {
                                out += 'let ';
                                empty = false;
                            } else {
                                if (i != 0) {
                                    out += ',';
                                }
                            }
                            localsUsed[node.variables[i].name] = true;
                            recurse(node.variables[i]);
                            if (i < node.init.length) {
                                out += '=';
                                recurse(node.init[i]);
                            }
                            // if (i != node.variables.length - 1) {
                            //     out += ',';
                            // }
                        }
                    }
                }

                if (noLocalList.length > 0) {
                    if (!empty) {
                        out += ';';
                    }
                    for (let i = 0; i < noLocalList.length; i++) {
                        let i2 = noLocalList[i];
                        recurse(node.variables[i2]);
                        // if (i < node.init.length) {
                            out += '=';
                            // recurse(node.init[i]);
                            recurse(node.init[i2]);
                        // }
                        if (i != noLocalList.length - 1) {
                            out += ',';
                        }
                    }
                    out += ';';
                } else {
                    if (!empty) {
                        out += ';';
                    }
                }

                break;
            case 'AssignmentStatement':
                // TODO: copy over localstatement
                for (let i = 0; i < node.variables.length; i++) {
                    recurse(node.variables[i]);
                    if (i < node.init.length) {
                        out += '=';
                        recurse(node.init[i]);
                    }
                    if (i != node.variables.length - 1) {
                        out += ',';
                    }
                }
                out += ';';
                break;
            case 'CallStatement':
                recurse(node.expression);
                out += ';';
                break;
            case 'FunctionDeclaration':
                if (node.identifier != null) {
                    if (node.isLocal && !localsUsed[node.identifier.name]) {
                        out += 'let ';
                    }
                    recurse(node.identifier);
                    out += '=';
                }
                out += 'function(';
                // recurse(node.parameters, true);
                for (let i = 0; i < node.parameters.length; i++) {
                    let c = node.parameters[i];
                    // if (c.type == 'VarargLiteral') {
                    //     out += '...';
                    // }
                    recurse(c);
                    if (i != node.parameters.length - 1) {
                        out += ',';
                    }
                }
                out += '){';
                recurse(node.body, true);
                out += '}';
                if (node.identifier != null) {
                    out += ';'
                }
                break;
            case 'ForNumericStatement':
                out += 'for(let ';
                recurse(node.variable);
                out += '=';
                recurse(node.start);
                out += ';';
                recurse(node.variable);
                out += '<=';
                recurse(node.end);
                out += ';';
                recurse(node.variable);
                if (node.step != null) {
                    out += '+=';
                    recurse(node.step);
                } else {
                    out += '++';
                }
                out += '){';
                recurse(node.body, true);
                out += '}';
                break;
            case 'ForGenericStatement':
                out += 'let _=';
                for (let i = 0; i < node.iterators.length; i++) {
                    recurse(node.iterators[i]);
                    if (i != node.iterators.length - 1) {
                        out += ',';
                    }
                }
                out += ',_f,_s,_v;if(typeof _==\'object\'){[_f,_s,_v]=_}else{_f=_}while(true){let[';
                for (let i = 0; i < node.variables.length; i++) {
                    recurse(node.variables[i]);
                    if (i != node.variables.length - 1) {
                        out += ',';
                    }
                }
                out += ']=_f(_s,_v);_v=';
                recurse(node.variables[0]);
                out += ';if(_v==null||_v==undefined){break}';
                recurse(node.body, true);
                out += '}';
                break;
            case 'Chunk':
                localsUsed = {};
                recurse(node.body, true);
                break;
            case 'Identifier':
                out += node.name;
                break;
            case 'StringLiteral':
                let s = node.raw;

                // Old: Using normal JS strings
                /*
                if (s[0] == '\'' || s[0] == '\"') {
                    // Normal string
                    out += s;
                } else {
                    // Long string
                    let i = 1;
                    while (true) {
                        if (s[i] == '[') {
                            break;
                        }
                        i++;
                    }
                    out += '`' + s.substring(i + 1, s.length - i - 1).replaceAll('`', '\\`').replaceAll('$', '\\$') + '`'
                }
                */

                // New: Using uint8array
                if (s[0] == '\'' || s[0] == '\"') {
                    // Normal string
                    let content = s.substring(1, s.length - 1);
                    out += 'new Uint8Array([';
                    let escape = false;
                    for (let i = 0; i < content.length; i++) {
                        if (content[i] == '\\' && escape) {
                            escape = true;
                        } else {
                            if (escape) {
                                // TODO: digits
                            } else {
                                out += content.charCodeAt(i);
                            }
                            if (i != content.length - 1) {
                                out += ',';
                            }
                        }
                    }
                    out += '])';
                } else {
                    // Long string
                    let i = 1;
                    while (true) {
                        if (s[i] == '[') {
                            break;
                        }
                        i++;
                    }
                    let content = s.substring(i + 1, s.length - i - 1);
                    out += 'new Uint8Array([';
                    for (let i = 0; i < content.length; i++) {
                        out += content.charCodeAt(i);
                        if (i != content.length - 1) {
                            out += ',';
                        }
                    }
                    out += '])';
                }

                break;
            case 'NumericLiteral':
                out += node.value;
                break;
            case 'BooleanLiteral':
                out += node.value;
                break;
            case 'NilLiteral':
                out += 'null';
                break;
            case 'VarargLiteral':
                if (lastLastNode.type == 'LogicalExpression' || lastLastNode.type == 'BinaryExpression' || lastLastNode.type == 'UnaryExpression' || lastLastNode.type == 'TableKey' || lastLastNode.type == 'TableKeyString') {
                    out += 'RuntimeInternal_VARARG[0]';
                } else if (lastLastNode.type == 'LocalStatement' || lastLastNode.type == 'AssignmentStatement') {
                    out += 'RuntimeInternal_VARARG';
                } else if (lastLastNode.type == 'TableValue') {
                    out += 'RuntimeInternal_VARARG';
                } else {
                    out += '...RuntimeInternal_VARARG';
                }
                break;
            case 'TableKey':
                out += '[';
                recurse(node.key);
                out += ']:';
                recurse(node.value);
                break;
            case 'TableKeyString':
                out += '[\'';
                recurse(node.key);
                out += '\']:';
                recurse(node.value);
                break;
            case 'TableValue':
                recurse(node.value);
                break;
            case 'TableConstructorExpression':
                let out2 = out;
                out = '';

                out += '{';
                let i2 = 1; // Counter for TableValue
                let trailingVararg = false;
                for (let i = 0; i < node.fields.length; i++) {
                    let c = node.fields[i];
                    // if (c.value.type == 'VarargLiteral') {
                    //     switch (c.type) {
                    //         case 'TableKey':
                    //             out += '[';
                    //             recurse(c.key);
                    //             out += ']:';
                    //             out += 'RuntimeInternal_VARARG[0]';
                    //             break;
                    //         case 'TableKeyString':
                    //             out += '[\'';
                    //             recurse(c.key);
                    //             out += '\']:';
                    //             out += 'RuntimeInternal_VARARG[0]';
                    //             break;
                    //         case 'TableValue':
                    //             out += '...RuntimeInternal_VARARG'
                    //             break;
                    //         default:
                    //             break;
                    //     }
                    // } else {
                        if (c.type == 'TableValue') {
                            if (c.value.type == 'VarargLiteral' && i == node.fields.length - 1) {
                                // out += i2 + ':';
                                // out += ''
                                trailingVararg = c;
                                i2++;
                            } else {
                                out += i2 + ':';
                                recurse(c);
                                if (c.value.type == 'VarargLiteral') {
                                    out += '[0]';
                                }
                                i2++;
                            }
                        } else {
                            recurse(c);
                        }
                        
                    // }
                    if (i != node.fields.length - 1 & !(i == node.fields.length - 2 && node.fields[i + 1].value.type == 'VarargLiteral')) {
                        out += ',';
                    }
                }
                out += '}';

                if (trailingVararg) {
                    out = out2 + 'RuntimeInternal.addVararg(' + out + ',';
                    recurse(trailingVararg);
                    out += ',' + (i2 - 1) + ')';
                } else {
                    out = out2 + out;
                }
                

                break;
            case 'LogicalExpression':
                recurse(node.left);
                switch (node.operator) {
                    case 'and':
                        out += '&&';
                        break;
                    case 'or':
                        out += '||';
                        break;
                }
                recurse(node.right);
                break;
            case 'BinaryExpression':
                out += '(';
                switch (node.operator) {
                    case '..':
                        out += 'RuntimeInternal.concatString(';
                        recurse(node.left);
                        out += ',';
                        recurse(node.right);
                        out += ')';
                        break;
                    case '==':
                        recurse(node.left);
                        out += '===';
                        recurse(node.right);
                        break;
                    case '>>':
                        recurse(node.left);
                        out += '>>';
                        recurse(node.right);
                        break;
                    case '>=':
                        recurse(node.left);
                        out += '>=';
                        recurse(node.right);
                        break;
                    case '>':
                        recurse(node.left);
                        out += '>';
                        recurse(node.right);
                        break;
                    case '<=':
                        recurse(node.left);
                        out += '<=';
                        recurse(node.right);
                        break;
                    case '<':
                        recurse(node.left);
                        out += '<';
                        recurse(node.right);
                        break;
                    case '~=':
                        recurse(node.left);
                        out += '!==';
                        recurse(node.right);
                        break;
                    case '~':
                        recurse(node.left);
                        out += '^';
                        recurse(node.right);
                        break;
                    case '//':
                        out += 'Math.floor(';
                        recurse(node.left);
                        out += '/';
                        recurse(node.right);
                        out += ')';
                        break;
                    case '/':
                        recurse(node.left);
                        out += '/';
                        recurse(node.right);
                        break;
                    case '*':
                        recurse(node.left);
                        out += '*';
                        recurse(node.right);
                        break;
                    case '^':
                        recurse(node.left);
                        out += '**';
                        recurse(node.right);
                        break;
                    case '%':
                        recurse(node.left);
                        out += '%';
                        recurse(node.right);
                        break;
                    case '-':
                        recurse(node.left);
                        out += '-';
                        recurse(node.right);
                        break;
                    case '+':
                        recurse(node.left);
                        out += '+';
                        recurse(node.right);
                        break;
                    default:
                        break;
                }
                out += ')';
                break;
            case 'UnaryExpression':
                switch (node.operator) {
                    case '#':
                        out += 'RuntimeInternal.getLength('
                        recurse(node.argument);
                        out += ')'
                        break;
                    case '-':
                        // Add parenthesis in case of exponentiation
                        out += '(';
                        out += '-';
                        recurse(node.argument);
                        out += ')';
                        break;
                    case '~':
                        out += '~';
                        recurse(node.argument);
                        break;
                    case 'not':
                        out += '!';
                        recurse(node.argument);
                        break;
                    default:
                        break;
                }
                break;
            case 'MemberExpression':
                recurse(node.base);
                out += '.';
                recurse(node.identifier);
                break;
            case 'IndexExpression':
                recurse(node.base);
                out += '[';
                recurse(node.index);
                out += ']';
                break;
            case 'CallExpression':
                recurse(node.base);
                out += '(';
                if (node.base.indexer == ':') {
                    recurse(node.base.base);
                    if (node.arguments.length > 0) {
                        out += ',';
                    }
                }
                for (let i = 0; i < node.arguments.length; i++) {
                    recurse(node.arguments[i]);
                    if (i != node.arguments.length - 1) {
                        out += ',';
                    }
                }
                out += ')';
                break;
            case 'TableCallExpression':
                recurse(node.base);
                out += '(';
                for (let i = 0; i < node.arguments.length; i++) {
                    recurse(node.arguments[i]);
                    if (i != node.arguments.length - 1) {
                        out += ',';
                    }
                }
                out += ')';
                break;
            case 'StringCallExpression':
                recurse(node.base);
                out += '(';
                recurse(node.argument);
                // for (let i = 0; i < node.arguments.length; i++) {
                //     recurse(node.arguments[i]);
                //     if (i != node.arguments.length - 1) {
                //         out += ',';
                //     }
                // }
                out += ')';
                break;
            case 'Comment':
                out += '/*' + node.value + '*/';
                break;

            default:
                console.error('ERROR: INVALID NODE');
                break;
                
        }
    }
    // scopes.pop();
}
recurse(ast);

// 4. Serialize all remaining comments
/*
for (let i = 0; i < comments.length; i++) {
    recurse(comments[i]);
}
// */


return out;


// console.log(out);

// var runtime = fs.readFileSync(runtimefile, {encoding: 'utf8', flag: 'r'});
// out = runtime + out;

}