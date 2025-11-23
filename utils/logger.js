const util = require("util");

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function getLevel() {
  const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug")).toLowerCase();
  if (envLevel in levels) return envLevel;
  return "info";
}

function shouldLog(targetLevel) {
  const current = levels[getLevel()];
  if (process.env.LOG_SILENT === "true") return false;
  return levels[targetLevel] >= current && current < levels.silent;
}

function ts() {
  return new Date().toISOString();
}

function format(message, args) {
  if (args.length === 0) return message;
  return `${message} ${args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 4, colors: false }))).join(" ")}`;
}

function baseLog(level, msg, ...args) {
  if (!shouldLog(level)) return;
  const line = `[${ts()}] ${level.toUpperCase()}: ${format(msg, args)}`;
  // Use appropriate console method
  if (level === "error") return console.error(line);
  if (level === "warn") return console.warn(line);
  return console.log(line);
}

const logger = {
  level: getLevel,
  debug: (msg, ...args) => baseLog("debug", msg, ...args),
  info: (msg, ...args) => baseLog("info", msg, ...args),
  warn: (msg, ...args) => baseLog("warn", msg, ...args),
  error: (msg, ...args) => baseLog("error", msg, ...args),
  child(bindings = {}) {
    const prefix = Object.keys(bindings).length ? ` ${JSON.stringify(bindings)}` : "";
    return {
      debug: (msg, ...args) => logger.debug(msg + prefix, ...args),
      info: (msg, ...args) => logger.info(msg + prefix, ...args),
      warn: (msg, ...args) => logger.warn(msg + prefix, ...args),
      error: (msg, ...args) => logger.error(msg + prefix, ...args),
    };
  },
};

module.exports = logger;
