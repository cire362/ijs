function serializeMeta(meta) {
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    };
  }

  if (meta && typeof meta === "object") {
    return meta;
  }

  if (meta == null) return undefined;
  return { value: meta };
}

function write(level, message, meta) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
  };

  const serializedMeta = serializeMeta(meta);
  if (serializedMeta !== undefined) {
    payload.meta = serializedMeta;
  }

  const line = JSON.stringify(payload);
  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

const logger = {
  log(message, meta) {
    write("info", message, meta);
  },
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  },
};

module.exports = logger;
