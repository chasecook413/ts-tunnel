## Experimental-tunnel

### Dependencies

Make sure you have [Typescript](https://www.typescriptlang.org/download) installed. You'll also need to install package dependencies. From the root of the project, run:

    npm install 

### Building:

    npm run compile

### Running:

Server-side of tunnel:

    npm run server

Client-side of tunnel:

    npm run client

### Testing:

The default proxy port is 4701, so you can point your browser there, or run:
    
    curl --proxy http://localhost:4701 https://google.com
