import ReadableStream from './readable-stream';
import WritableStream from './writable-stream';

export default class TransformStream {
  constructor({ transform, flush = (enqueue, close) => close(), writableStrategy, readableStrategy }) {
    if (typeof transform !== 'function') {
      throw new TypeError('transform must be a function');
    }

    let writeChunk, writeDone, errorWritable;
    let transforming = false;
    let chunkWrittenButNotYetTransformed = false;
    this.writable = new WritableStream({
      start(error) {
        errorWritable = error;
      },
      write(chunk) {
        writeChunk = chunk;
        chunkWrittenButNotYetTransformed = true;

        const p = new Promise(resolve => writeDone = resolve);
        maybeDoTransform();
        return p;
      },
      close() {
        try {
          flush(enqueueInReadable, closeReadable);
        } catch (e) {
          errorWritable(e);
          errorReadable(e);
        }
      }
    }, writableStrategy);

    let enqueueInReadable, closeReadable, errorReadable;
    this.readable = new ReadableStream({
      start(c) {
        enqueueInReadable = c.enqueue.bind(c);
        closeReadable = c.close.bind(c);
        errorReadable = c.error.bind(c);
      },
      pull() {
        if (chunkWrittenButNotYetTransformed === true) {
          maybeDoTransform();
        }
      }
    }, readableStrategy);

    function maybeDoTransform() {
      if (transforming === false) {
        transforming = true;
        try {
          transform(writeChunk, enqueueInReadable, transformDone);
          writeChunk = undefined;
          chunkWrittenButNotYetTransformed = false;
        } catch (e) {
          transforming = false;
          errorWritable(e);
          errorReadable(e);
        }
      }
    }

    function transformDone() {
      transforming = false;
      writeDone();
    }
  }
}
