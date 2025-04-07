#!/usr/bin/env node
import { VectraMcpServer } from './server.js';

// Create and run the server instance
const server = new VectraMcpServer();
server.run().catch(console.error);
