function parseBool(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function shouldRunScheduledJobs() {
  if (process.env.NODE_ENV === "test") return false;
  return parseBool(process.env.RUN_SCHEDULED_JOBS, true);
}

function startScheduledJobs(definitions, logger = console) {
  if (!shouldRunScheduledJobs()) {
    logger.log("Scheduled jobs are disabled for this process");
    return () => {};
  }

  const stopFns = definitions.map((definition) => {
    const { name, intervalMs, job, runImmediately = false } = definition;

    let running = false;

    const execute = async (trigger) => {
      if (running) {
        logger.warn(
          `Skipping job '${name}' because a previous run is still active`,
        );
        return;
      }

      const startedAt = Date.now();
      running = true;

      try {
        const result = await job();
        logger.log(
          `Job '${name}' completed via ${trigger} in ${Date.now() - startedAt}ms`,
          result,
        );
      } catch (error) {
        logger.error(`Job '${name}' failed`, error);
      } finally {
        running = false;
      }
    };

    if (runImmediately) {
      execute("startup").catch((error) => {
        logger.error(`Job '${name}' failed during startup`, error);
      });
    }

    const timer = setInterval(() => {
      execute("interval").catch((error) => {
        logger.error(`Job '${name}' failed during interval dispatch`, error);
      });
    }, intervalMs);
    timer.unref?.();

    return () => clearInterval(timer);
  });

  return () => {
    for (const stop of stopFns) {
      stop();
    }
  };
}

module.exports = {
  shouldRunScheduledJobs,
  startScheduledJobs,
};
