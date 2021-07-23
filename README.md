## Experimental-tunnel

### Dependencies

Make sure you have [Typescript](https://www.typescriptlang.org/download) installed. You'll also need to install package dependencies. From the root of the project, run:

    npm install 

### Building:

    tsc lib/server/index.js
    tsc lib/client/index.js

### Running:
    node lib/server/index.js
    node lib/client/index.js

### Testing:

The default proxy port is 4701, so you can point your browser there, or run:
    
    curl --proxy http://localhost:4701 https://google.com
