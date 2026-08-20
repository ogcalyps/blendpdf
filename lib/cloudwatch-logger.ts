import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogGroupCommand, CreateLogStreamCommand, DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  requestId?: string;
  timestamp?: Date;
}

class CloudWatchLogger {
  private client: CloudWatchLogsClient;
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken: string | undefined;
  private buffer: Array<{ timestamp: number; message: string }> = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
  private readonly MAX_BUFFER_SIZE = 100; // Max events before forced flush

  constructor() {
    // Use same region as S3
    const region = process.env.AWS_REGION || 'eu-north-1';
    this.logGroupName = process.env.CLOUDWATCH_LOG_GROUP || '/aws/blendpdf/application';
    this.logStreamName = `${process.env.CLOUDWATCH_LOG_STREAM || 'app'}-${new Date().toISOString().split('T')[0]}`;
    
    this.client = new CloudWatchLogsClient({
      region,
      // Uses IAM role credentials automatically (same as S3)
    });

    // Initialize log group and stream
    this.initialize().catch(err => {
      console.error('[CloudWatchLogger] Failed to initialize:', err);
    });

    // Set up periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.error('[CloudWatchLogger] Flush error:', err);
      });
    }, this.FLUSH_INTERVAL_MS);

    // Flush on process exit
    process.on('SIGTERM', () => this.flushSync());
    process.on('SIGINT', () => this.flushSync());
    process.on('exit', () => this.flushSync());
  }

  private async initialize() {
    try {
      // Create log group if it doesn't exist
      try {
        await this.client.send(new CreateLogGroupCommand({
          logGroupName: this.logGroupName,
        }));
        console.log(`[CloudWatchLogger] Created log group: ${this.logGroupName}`);
      } catch (err: any) {
        // Log group already exists is fine
        if (err.name !== 'ResourceAlreadyExistsException') {
          throw err;
        }
      }

      // Create log stream if it doesn't exist
      try {
        await this.client.send(new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        }));
        console.log(`[CloudWatchLogger] Created log stream: ${this.logStreamName}`);
      } catch (err: any) {
        // Log stream already exists is fine
        if (err.name !== 'ResourceAlreadyExistsException') {
          throw err;
        }
      }

      // Get sequence token for existing stream
      await this.getSequenceToken();
    } catch (error) {
      console.error('[CloudWatchLogger] Initialization error:', error);
      // Continue without CloudWatch - will fall back to console only
    }
  }

  private async getSequenceToken() {
    try {
      const response = await this.client.send(new DescribeLogStreamsCommand({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName,
        limit: 1,
      }));

      if (response.logStreams && response.logStreams.length > 0) {
        this.sequenceToken = response.logStreams[0].uploadSequenceToken;
      }
    } catch (error) {
      console.error('[CloudWatchLogger] Error getting sequence token:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp || new Date();
    const logData: any = {
      level: entry.level,
      message: entry.message,
      timestamp: timestamp.toISOString(),
    };

    if (entry.requestId) {
      logData.requestId = entry.requestId;
    }

    if (entry.data) {
      logData.data = entry.data;
    }

    return JSON.stringify(logData);
  }

  async log(entry: LogEntry) {
    // Always log to console (for PM2 file logs)
    const formattedMessage = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        // Only log debug in development
        if (process.env.NODE_ENV !== 'production') {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }

    // Add to buffer for CloudWatch
    this.buffer.push({
      timestamp: (entry.timestamp || new Date()).getTime(),
      message: formattedMessage,
    });

    // Flush if buffer is full
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const events = this.buffer.map(entry => ({
      timestamp: entry.timestamp,
      message: entry.message,
    }));

    this.buffer = [];

    try {
      const command = new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: events,
        sequenceToken: this.sequenceToken,
      });

      const response = await this.client.send(command);
      this.sequenceToken = response.nextSequenceToken;
    } catch (error: any) {
      // Handle sequence token errors
      if (error.name === 'InvalidSequenceTokenException' || error.name === 'DataAlreadyAcceptedException') {
        // Get new sequence token and retry
        await this.getSequenceToken();
        try {
          const retryCommand = new PutLogEventsCommand({
            logGroupName: this.logGroupName,
            logStreamName: this.logStreamName,
            logEvents: events,
            sequenceToken: this.sequenceToken,
          });
          const retryResponse = await this.client.send(retryCommand);
          this.sequenceToken = retryResponse.nextSequenceToken;
        } catch (retryError) {
          console.error('[CloudWatchLogger] Retry failed:', retryError);
          // Put events back in buffer for next flush
          this.buffer.unshift(...events.map(e => ({
            timestamp: e.timestamp,
            message: e.message,
          })));
        }
      } else {
        console.error('[CloudWatchLogger] Flush error:', error);
        // Put events back in buffer for next flush
        this.buffer.unshift(...events.map(e => ({
          timestamp: e.timestamp,
          message: e.message,
        })));
      }
    }
  }

  private async flushSync() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  // Convenience methods
  info(message: string, data?: any, requestId?: string) {
    return this.log({ level: 'info', message, data, requestId });
  }

  warn(message: string, data?: any, requestId?: string) {
    return this.log({ level: 'warn', message, data, requestId });
  }

  error(message: string, data?: any, requestId?: string) {
    return this.log({ level: 'error', message, data, requestId });
  }

  debug(message: string, data?: any, requestId?: string) {
    return this.log({ level: 'debug', message, data, requestId });
  }
}

// Singleton instance
let loggerInstance: CloudWatchLogger | null = null;

export function getLogger(): CloudWatchLogger {
  if (!loggerInstance) {
    // Only create CloudWatch logger in production
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_CLOUDWATCH_LOGS !== 'false') {
      loggerInstance = new CloudWatchLogger();
    } else {
      // Fallback to console-only logger
      loggerInstance = {
        log: (entry: LogEntry) => {
          const formatted = JSON.stringify({
            level: entry.level,
            message: entry.message,
            data: entry.data,
            requestId: entry.requestId,
            timestamp: (entry.timestamp || new Date()).toISOString(),
          });
          switch (entry.level) {
            case 'error': console.error(formatted); break;
            case 'warn': console.warn(formatted); break;
            case 'debug': if (process.env.NODE_ENV !== 'production') console.debug(formatted); break;
            default: console.log(formatted);
          }
        },
        info: (msg: string, data?: any, reqId?: string) => console.log(JSON.stringify({ level: 'info', message: msg, data, requestId: reqId })),
        warn: (msg: string, data?: any, reqId?: string) => console.warn(JSON.stringify({ level: 'warn', message: msg, data, requestId: reqId })),
        error: (msg: string, data?: any, reqId?: string) => console.error(JSON.stringify({ level: 'error', message: msg, data, requestId: reqId })),
        debug: (msg: string, data?: any, reqId?: string) => {
          if (process.env.NODE_ENV !== 'production') {
            console.debug(JSON.stringify({ level: 'debug', message: msg, data, requestId: reqId }));
          }
        },
      } as CloudWatchLogger;
    }
  }
  return loggerInstance;
}

// Export convenience functions
export const logger = {
  info: (message: string, data?: any, requestId?: string) => getLogger().info(message, data, requestId),
  warn: (message: string, data?: any, requestId?: string) => getLogger().warn(message, data, requestId),
  error: (message: string, data?: any, requestId?: string) => getLogger().error(message, data, requestId),
  debug: (message: string, data?: any, requestId?: string) => getLogger().debug(message, data, requestId),
};

