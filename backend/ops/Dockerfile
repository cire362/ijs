FROM node:22-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY ops ./ops

FROM postgres:15-alpine
RUN apk add --no-cache libstdc++ libgcc && addgroup -g 1000 ops && adduser -D -u 1000 -G ops ops
COPY --from=runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=runtime /app /app
RUN mkdir -p /backups /mirror /restore-uploads /work && chown -R ops:ops /app /backups /mirror /restore-uploads /work
WORKDIR /app
USER ops
ENTRYPOINT ["node"]
CMD ["ops/backup.js", "--daemon"]
