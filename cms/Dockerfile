FROM node:20

# Installing libvips-dev for sharp Compatibility
RUN apt-get update && apt-get install -y libvips-dev git

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/
COPY package.json ./
RUN npm install
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY . .

RUN chown -R node:node /opt/app
USER node

# RUN ["npm", "run", "build"]
EXPOSE 1337
CMD ["npm", "run", "develop"]
