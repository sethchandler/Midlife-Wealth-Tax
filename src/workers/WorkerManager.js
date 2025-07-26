/**
 * Web Worker manager for handling optimization computations in background threads.
 * Manages worker lifecycle, load balancing, and communication.
 */

export class WorkerManager {
    constructor(options = {}) {
        this.options = {
            maxWorkers: navigator.hardwareConcurrency || 4,
            workerScript: './src/workers/optimization-worker.js',
            timeout: 30000, // 30 seconds
            ...options
        };
        
        this.workers = [];
        this.activeJobs = new Map();
        this.jobQueue = [];
        this.nextJobId = 1;
        this.isInitialized = false;
        
        // Performance tracking
        this.stats = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            totalTime: 0,
            avgTime: 0
        };
    }

    /**
     * Initializes the worker pool.
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Create worker pool
            for (let i = 0; i < this.options.maxWorkers; i++) {
                await this.createWorker();
            }
            
            this.isInitialized = true;
            console.log(`Worker pool initialized with ${this.workers.length} workers`);
            
        } catch (error) {
            console.error('Failed to initialize worker pool:', error);
            throw error;
        }
    }

    /**
     * Creates a new worker and sets up event handlers.
     */
    async createWorker() {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(this.options.workerScript, { type: 'module' });
                
                worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
                worker.onerror = (error) => this.handleWorkerError(worker, error);
                
                const workerInfo = {
                    worker,
                    id: this.workers.length,
                    busy: false,
                    currentJobId: null
                };
                
                this.workers.push(workerInfo);
                resolve(workerInfo);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handles messages from workers.
     */
    handleWorkerMessage(worker, event) {
        const { type, id, result, error, progress } = event.data;
        const job = this.activeJobs.get(id);
        
        if (!job) {
            return; // Job might have been cancelled
        }

        switch (type) {
            case 'result':
                this.completeJob(id, result);
                this.freeWorker(worker);
                this.processQueue();
                break;
                
            case 'error':
                this.failJob(id, new Error(error));
                this.freeWorker(worker);
                this.processQueue();
                break;
                
            case 'progress':
                if (job.onProgress) {
                    job.onProgress(progress);
                }
                break;
                
            case 'cacheCleared':
                console.log('Worker cache cleared');
                break;
        }
    }

    /**
     * Handles worker errors.
     */
    handleWorkerError(worker, error) {
        console.error('Worker error:', error);
        
        // Find jobs assigned to this worker and fail them
        for (const [jobId, job] of this.activeJobs) {
            const workerInfo = this.workers.find(w => w.worker === worker);
            if (workerInfo && workerInfo.currentJobId === jobId) {
                this.failJob(jobId, new Error('Worker crashed'));
            }
        }
        
        // Replace the failed worker
        this.replaceWorker(worker);
    }

    /**
     * Replaces a failed worker with a new one.
     */
    async replaceWorker(failedWorker) {
        const workerIndex = this.workers.findIndex(w => w.worker === failedWorker);
        if (workerIndex === -1) return;

        try {
            failedWorker.terminate();
            const newWorkerInfo = await this.createWorker();
            this.workers[workerIndex] = newWorkerInfo;
            console.log(`Replaced failed worker ${workerIndex}`);
        } catch (error) {
            console.error('Failed to replace worker:', error);
        }
    }

    /**
     * Submits an optimization job to the worker pool.
     */
    async optimizeWealth(parameters, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const jobId = this.nextJobId++;
            const job = {
                id: jobId,
                type: 'optimize',
                parameters,
                options,
                resolve,
                reject,
                onProgress: options.onProgress,
                timestamp: Date.now(),
                timeout: null
            };

            // Set timeout
            job.timeout = setTimeout(() => {
                this.failJob(jobId, new Error('Job timeout'));
            }, this.options.timeout);

            this.activeJobs.set(jobId, job);
            this.stats.totalJobs++;

            // Try to assign to available worker immediately
            const availableWorker = this.findAvailableWorker();
            if (availableWorker) {
                this.assignJobToWorker(job, availableWorker);
            } else {
                // Queue the job
                this.jobQueue.push(job);
            }
        });
    }

    /**
     * Finds an available worker.
     */
    findAvailableWorker() {
        return this.workers.find(w => !w.busy);
    }

    /**
     * Assigns a job to a specific worker.
     */
    assignJobToWorker(job, workerInfo) {
        workerInfo.busy = true;
        workerInfo.currentJobId = job.id;
        
        workerInfo.worker.postMessage({
            type: job.type,
            id: job.id,
            parameters: job.parameters,
            options: job.options
        });
    }

    /**
     * Frees a worker and marks it as available.
     */
    freeWorker(worker) {
        const workerInfo = this.workers.find(w => w.worker === worker);
        if (workerInfo) {
            workerInfo.busy = false;
            workerInfo.currentJobId = null;
        }
    }

    /**
     * Processes the job queue.
     */
    processQueue() {
        while (this.jobQueue.length > 0) {
            const availableWorker = this.findAvailableWorker();
            if (!availableWorker) {
                break;
            }

            const job = this.jobQueue.shift();
            this.assignJobToWorker(job, availableWorker);
        }
    }

    /**
     * Completes a job successfully.
     */
    completeJob(jobId, result) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

        clearTimeout(job.timeout);
        this.activeJobs.delete(jobId);
        
        // Update stats
        this.stats.completedJobs++;
        const jobTime = Date.now() - job.timestamp;
        this.stats.totalTime += jobTime;
        this.stats.avgTime = this.stats.totalTime / this.stats.completedJobs;

        job.resolve(result);
    }

    /**
     * Fails a job with an error.
     */
    failJob(jobId, error) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;

        clearTimeout(job.timeout);
        this.activeJobs.delete(jobId);
        this.stats.failedJobs++;

        job.reject(error);
    }

    /**
     * Clears all worker caches.
     */
    async clearCaches() {
        const promises = this.workers.map(workerInfo => {
            return new Promise((resolve) => {
                const jobId = this.nextJobId++;
                workerInfo.worker.postMessage({
                    type: 'clearCache',
                    id: jobId
                });
                resolve();
            });
        });

        await Promise.all(promises);
    }

    /**
     * Gets performance statistics.
     */
    getStats() {
        return {
            ...this.stats,
            workers: {
                total: this.workers.length,
                busy: this.workers.filter(w => w.busy).length,
                available: this.workers.filter(w => !w.busy).length
            },
            queue: {
                length: this.jobQueue.length
            },
            successRate: this.stats.completedJobs / Math.max(this.stats.totalJobs, 1)
        };
    }

    /**
     * Cancels all pending jobs and destroys the worker pool.
     */
    async destroy() {
        // Cancel all active jobs
        for (const [jobId, job] of this.activeJobs) {
            clearTimeout(job.timeout);
            job.reject(new Error('Worker pool destroyed'));
        }
        this.activeJobs.clear();
        this.jobQueue = [];

        // Terminate all workers
        this.workers.forEach(workerInfo => {
            workerInfo.worker.terminate();
        });
        this.workers = [];

        this.isInitialized = false;
        console.log('Worker pool destroyed');
    }
}

/**
 * Global worker manager instance.
 */
export const workerManager = new WorkerManager();