package workerpool

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// Process bounds concurrent work, keeps input order, and joins every worker.
// fn must cooperate with ctx; cancellation cannot forcibly stop arbitrary code.
func Process(ctx context.Context, workers int, input []int, fn func(context.Context, int) (int, error)) ([]int, error) {
	if workers < 1 {
		return nil, errors.New("workers must be positive")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	workCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int)
	output := make([]int, len(input))
	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for index := range jobs {
				if workCtx.Err() != nil {
					return
				}
				value, err := fn(workCtx, input[index])
				if err != nil {
					once.Do(func() { firstErr = fmt.Errorf("item %d: %w", index, err); cancel() })
					return
				}
				output[index] = value // each index has exactly one writer
			}
		}()
	}
feed:
	for index := range input {
		select {
		case jobs <- index:
		case <-workCtx.Done():
			break feed
		}
	}
	close(jobs) // only the producer owns closure
	wg.Wait()   // no worker may outlive this call
	if firstErr != nil {
		return nil, firstErr
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return output, nil
}
