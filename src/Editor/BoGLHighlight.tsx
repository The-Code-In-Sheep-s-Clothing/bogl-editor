//
// BoGLHighlight.tsx
//
// Syntax Highlighting for BoGL
//

function BoGLHighlight() {
  function switchState(source, setState, f) {
    setState(f);
    return f(source, setState);
  }

  // These should all be Unicode extended, as per the Haskell 2010 report
  let smallRE = /[a-z_]/;
  let largeRE = /[A-Z]/;
  let digitRE = /\d/;
  let hexitRE = /[0-9A-Fa-f]/;
  let octitRE = /[0-7]/;
  let idRE = /[a-z_A-Z0-9'\xa1-\uffff]/;
  let symbolRE = /[-!#$%&*+./<=>?@\\^|~:]/;
  let specialRE = /[(),;[\]`{}]/;
  let whiteCharRE = /[ \t\v\f]/; // newlines are handled in tokenizer

  function normal(source, setState) {
    if (source.eatWhile(whiteCharRE)) {
      return null;
    }

    let ch = source.next();
    if (specialRE.test(ch)) {
      if (ch === '{' && source.eat('-')) {
        let t = "comment";
        if (source.eat('#')) {
          t = "meta";
        }
        return switchState(source, setState, ncomment(t, 1));
      }
      return null;
    }

    if (ch === '\'') {
      if (source.eat('\\')) {
        source.next();  // should handle other escapes here
      }
      else {
        source.next();
      }
      if (source.eat('\'')) {
        return "string";
      }
      return "string error";
    }

    if (ch === '"') {
      return switchState(source, setState, stringLiteral);
    }

    if (largeRE.test(ch)) {
      source.eatWhile(idRE);
      if (source.eat('.')) {
        return "qualifier";
      }
      return "variable-2";
    }

    if (smallRE.test(ch)) {
      source.eatWhile(idRE);
      return "variable";
    }

    if (digitRE.test(ch)) {
      if (ch === '0') {
        if (source.eat(/[xX]/)) {
          source.eatWhile(hexitRE); // should require at least 1
          return "integer";
        }
        if (source.eat(/[oO]/)) {
          source.eatWhile(octitRE); // should require at least 1
          return "number";
        }
      }
      source.eatWhile(digitRE);
      let t = "number";
      if (source.match(/^\.\d+/)) {
        t = "number";
      }
      if (source.eat(/[eE]/)) {
        t = "number";
        source.eat(/[-+]/);
        source.eatWhile(digitRE); // should require at least 1
      }
      return t;
    }

    if (ch === "." && source.eat("."))
      return "keyword";

    if (symbolRE.test(ch)) {
      if (ch === '-' && source.eat(/-/)) {
        source.eatWhile(/-/);
        if (!source.eat(symbolRE)) {
          source.skipToEnd();
          return "comment";
        }
      }
      let t = "variable";
      if (ch === ':') {
        t = "variable-2";
      }
      source.eatWhile(symbolRE);
      return t;
    }

    return "error";
  }

  function ncomment(type, nest) {
    if (nest === 0) {
      return normal;
    }
    return function(source, setState) {
      var currNest = nest;
      while (!source.eol()) {
        var ch = source.next();
        if (ch === '{' && source.eat('-')) {
          ++currNest;
        }
        else if (ch === '-' && source.eat('}')) {
          --currNest;
          if (currNest === 0) {
            setState(normal);
            return type;
          }
        }
      }
      setState(ncomment(type, currNest));
      return type;
    };
  }

  function stringLiteral(source, setState) {
    while (!source.eol()) {
      var ch = source.next();
      if (ch === '"') {
        setState(normal);
        return "string";
      }
      if (ch === '\\') {
        if (source.eol() || source.eat(whiteCharRE)) {
          setState(stringGap);
          return "string";
        }
        if (source.eat('&')) {
        }
        else {
          source.next(); // should handle other escapes here
        }
      }
    }
    setState(normal);
    return "string error";
  }

  function stringGap(source, setState) {
    if (source.eat('\\')) {
      return switchState(source, setState, stringLiteral);
    }
    source.next();
    setState(normal);
    return "error";
  }


  var wellKnownWords = (function() {
    var wkw = {};

    function setType(type,items) {
      for (var i = 0; i < items.length; i++) {
        wkw[items[i]] = type;
      }
    }

    // literal keywords
    setType("keyword",
      ["do", "if", "then", "else", "in", "let", "of", "type", "where", "game", "break", "while"]);

    // keyword sequences
    setType("keyword",
      ["..", ":", "\\", "<-", "->", "!", "="]);

    // highlight operators (same as types)
    setType("builtin",
      ["&&", "+", "-", ".", "/", "/=", "<", "<=", "==", ">", ">=", "||", "*", "?"]);

    // highlight types
    setType("builtin",
      ["Bool","False","True","Int","Board","Array","Input","Player","Content"]);

    // highlight built-in functions
    setType("builtin",
      ["input","place","countBoard","countCol","countRow","countDiag","isFull","inARow","not","or","and"]);

    return wkw;
  })();



  return {
    startState: function ()  { return { f: normal }; },
    copyState:  function (s) { return { f: s.f }; },

    token: function(stream, state) {
      let t = state.f(stream, function(s) { state.f = s; });
      let w = stream.current();
      return wellKnownWords.hasOwnProperty(w) ? wellKnownWords[w] : t;
    },

    blockCommentStart: "{-",
    blockCommentEnd: "-}",
    lineComment: "--"
  };
}

export default BoGLHighlight;
