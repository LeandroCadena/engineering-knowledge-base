package workerpool

import (
	"context"
	"errors"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

func TestOrderedAndBounded(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	started := make(chan struct{}, 5)
	release := make(chan struct{})
	var active, peak atomic.Int32
	type outcome struct {
		values []int
		err    error
	}
	done := make(chan outcome, 1)
	go func() {
		values, err := Process(ctx, 2, []int{4, 3, 2, 1, 0}, func(ctx context.Context, n int) (int, error) {
			now := active.Add(1)
			defer active.Add(-1)
			for old := peak.Load(); now > old; old = peak.Load() {
				if peak.CompareAndSwap(old, now) {
					break
				}
			}
			started <- struct{}{}
			select {
			case <-release:
				return n * n, nil
			case <-ctx.Done():
				return 0, ctx.Err()
			}
		})
		done <- outcome{values, err}
	}()
	for range 2 {
		select {
		case <-started:
		case <-ctx.Done():
			t.Fatal("workers did not start")
		}
	}
	if peak.Load() != 2 {
		t.Fatalf("peak before release = %d", peak.Load())
	}
	close(release)
	select {
	case got := <-done:
		if got.err != nil || !reflect.DeepEqual(got.values, []int{16, 9, 4, 1, 0}) {
			t.Fatalf("result: %+v", got)
		}
	case <-ctx.Done():
		t.Fatal("pool did not join")
	}
	if peak.Load() > 2 || active.Load() != 0 {
		t.Fatal("concurrency bound or join violated")
	}
}

func TestFailureCancelsAndJoinsSibling(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	sentinel := errors.New("provider rejected item")
	siblingStarted := make(chan struct{})
	var active atomic.Int32
	_, err := Process(ctx, 2, []int{1, 2}, func(ctx context.Context, n int) (int, error) {
		active.Add(1)
		defer active.Add(-1)
		if n == 1 {
			select {
			case <-siblingStarted:
				return 0, sentinel
			case <-ctx.Done():
				return 0, ctx.Err()
			}
		}
		close(siblingStarted)
		<-ctx.Done()
		return 0, ctx.Err()
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected wrapped provider error, got %v", err)
	}
	if active.Load() != 0 {
		t.Fatal("worker outlived Process")
	}
}

func TestAlreadyCanceledDoesNotInvokeCallback(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := Process(ctx, 1, []int{1}, func(context.Context, int) (int, error) { t.Fatal("callback invoked"); return 0, nil })
	if !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}

func TestInvalidWorkersAndEmptyInput(t *testing.T) {
	fn := func(_ context.Context, n int) (int, error) { return n, nil }
	if _, err := Process(context.Background(), 0, []int{1}, fn); err == nil {
		t.Fatal("expected validation error")
	}
	got, err := Process(context.Background(), 2, nil, fn)
	if err != nil || len(got) != 0 {
		t.Fatalf("empty input: %v %v", got, err)
	}
}
