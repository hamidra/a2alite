# A2A Agent Framework

A TypeScript framework for building AI Agents that can communicate using the Agent-to-Agent (A2A) specification.

## Features

- **Core A2A Communication**: Implements the A2A specification for agent communication
- **Modular Architecture**: Pluggable modules for extending functionality
- **State Management**: Built-in state management for tasks and messages
- **Agent Cards**: Generate and publish agent metadata following the A2A specification
- **HTTP Server**: Built-in HTTP server for agent communication

## Core Components

### 1. Framework

The main entry point for the A2A Framework. Handles initialization, module management, and cleanup.

### 2. State Management

Manages the state of tasks and messages, with support for different storage backends.

### 3. Agent Card

Generates and manages agent metadata following the A2A specification.

### 4. Server

HTTP server for handling agent communication, with support for REST and Server-Sent Events (SSE).

## Acknowledgments

- [A2A Specification](https://google.github.io/A2A/specification/)
- Inspired by various agent frameworks and communication protocols
