import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
} from 'react';
import classnames from 'classnames';

import { TrackProps, TrackRef, SlideChangeOption } from './interface';
import { PREFIX_CLS } from './constants';

const Track = React.forwardRef<TrackRef, TrackProps>(
  (
    {
      children,
      slideWidth = 0,
      slideHeight = 0,
      infinite = true,
      threshhold = 0,
      vertical = false,
      autoplay = false,
      autoplayInterval = 2000,
    }: TrackProps,
    ref: React.ForwardedRef<any>,
  ) => {
    const [currentSlide, setCurrentSlide] = useState<number>(0);
    const [animationFlag, setAnimationFlag] = useState<boolean>(false); // 是否需要动效
    const [animationPaused, setAnimationPaused] = useState<boolean>(true); // 动画是否处于暂停状态

    const trackRef = useRef<HTMLDivElement | null>(null);
    const touchPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const autoplayTimerRef = useRef<NodeJS.Timer>();

    const renderSlides = useCallback(() => {
      const slides: React.ReactElement[] = [];
      const preClone: React.ReactElement[] = [];
      const postClone: React.ReactElement[] = [];

      // 预加载逻辑
      React.Children.forEach(children, (child, i) => {
        slides.push(
          <div
            key={i}
            data-index={i}
            style={{
              flexShrink: 0,
              width: slideWidth ? `${slideWidth}px` : '100%',
              height: slideHeight ? `${slideHeight}px` : 'auto',
            }}
          >
            {child}
          </div>,
        );

        if (infinite && React.Children.count(children) !== 1) {
          i === React.Children.count(children) - 1 &&
            preClone.push(React.cloneElement(slides[i], { key: -1, 'data-index': -1 }));

          postClone.push(
            React.cloneElement(slides[i], {
              key: i + React.Children.count(children),
              'data-index': i + React.Children.count(children),
            }),
          );
        }
      });

      return preClone.concat(slides, postClone);
    }, [slideWidth, slideHeight, children, React.Children.count(children), infinite]);

    const preCloneLength = useMemo(() => {
      if (!infinite || React.Children.count(children) <= 1) {
        return 0;
      }

      return 1;
    }, [infinite, React.Children.count(children)]);

    const postCloneLength = useMemo(() => {
      if (!infinite || React.Children.count(children) <= 1) {
        return 0;
      }

      return React.Children.count(children);
    }, [infinite, React.Children.count(children)]);

    const changeSlide = useCallback(
      ({ message, index }: SlideChangeOption) => {
        if (!animationPaused || React.Children.count(children) <= 1) {
          return;
        }

        let targetSlide = currentSlide;
        switch (message) {
          case 'index':
            targetSlide = index || 0;
            break;

          case 'prev':
            if (infinite || targetSlide - 1 >= 0) {
              targetSlide -= 1;
            }

            break;

          case 'next':
            if (infinite || targetSlide + 1 <= React.Children.count(children) - 1) {
              targetSlide += 1;
            }

            break;

          default:
            break;
        }

        if (targetSlide !== currentSlide) {
          !animationFlag && setAnimationFlag(true);
          setAnimationPaused(false);

          setCurrentSlide(targetSlide);
        }
      },
      [animationPaused, currentSlide, React.Children.count(children), infinite],
    );

    const trackTranslate: number | string = useMemo(() => {
      if ((!vertical && slideWidth) || (vertical && slideHeight)) {
        // 加载完成后，slide轨道平移计算
        // 竖直按slide高度计算，水平按slide宽度计算
        if (!infinite || React.Children.count(children) <= 1) {
          return -(vertical ? slideHeight : slideWidth) * currentSlide;
        } else {
          return -(vertical ? slideHeight : slideWidth) * (currentSlide + 1);
        }
      } else {
        // 加载完成前，slide宽度样式按100%计算
        if (!infinite || React.Children.count(children) <= 1) {
          return 0;
        } else {
          return '-100%';
        }
      }
    }, [vertical, slideWidth, slideHeight, infinite, React.Children.count(children), currentSlide]);

    const trackStyle = useMemo(() => {
      let width, height;

      if (!vertical) {
        height = 'auto';
        if (slideWidth) {
          width = `${
            (preCloneLength + React.Children.count(children) + postCloneLength) * slideWidth
          }px`;
        } else {
          width = '100%';
        }

        return {
          width,
          height,
          transform:
            typeof trackTranslate === 'number'
              ? `translateX(${trackTranslate}px)`
              : `translateX(${trackTranslate})`,
        };
      }

      width = '100%';
      if (slideHeight) {
        height = `${
          (preCloneLength + React.Children.count(children) + postCloneLength) * slideHeight
        }px`;
      } else {
        height = `100%`;
      }
      return {
        width,
        height,
        transform:
          typeof trackTranslate === 'number'
            ? `translateY(${trackTranslate}px)`
            : `translateY(${trackTranslate})`,
      };
    }, [vertical, slideWidth, slideHeight, infinite, React.Children.count(children), currentSlide]);

    const slideOutOfBounds = useCallback(
      (slideDistance: number) => {
        if (infinite) {
          return false;
        }

        if (currentSlide === React.Children.count(children) - 1 && slideDistance < 0) {
          return true;
        }

        if (currentSlide === 0 && slideDistance > 0) {
          return true;
        }

        return false;
      },
      [infinite, currentSlide, React.Children.count(children)],
    );

    const touchStart = useCallback(
      (e: React.TouchEvent) => {
        if (autoplay && autoplayTimerRef.current) {
          clearInterval(autoplayTimerRef.current);
        }

        touchPointRef.current.x = e.touches[0].pageX;
        touchPointRef.current.y = e.touches[0].pageY;
      },
      [autoplay, autoplayTimerRef.current],
    );

    const touchMove = useCallback(
      (e: React.TouchEvent) => {
        if (trackRef.current && typeof trackTranslate === 'number') {
          const slideDistance = vertical
            ? e.touches[0].pageY - touchPointRef.current.y
            : e.touches[0].pageX - touchPointRef.current.x;
          const slideRate = slideOutOfBounds(slideDistance) ? 0.5 : 1;

          if (!vertical) {
            trackRef.current.style.transform = `translateX(${
              trackTranslate + slideRate * slideDistance
            }px)`;
          } else {
            trackRef.current.style.transform = `translateY(${
              trackTranslate + slideRate * slideDistance
            }px)`;
          }
        }
      },
      [trackTranslate, vertical, touchPointRef.current.x, touchPointRef.current.y],
    );

    const touchEnd = useCallback(
      (e: React.TouchEvent) => {
        const validThreshhold = Math.min(Math.max(0, threshhold), 1);
        const slideDistance = vertical
          ? e.changedTouches[0].pageY - touchPointRef.current.y
          : e.changedTouches[0].pageX - touchPointRef.current.x;

        // 根据滑动距离判断是否切换下一张
        if (
          slideOutOfBounds(slideDistance) ||
          Math.abs(slideDistance) < validThreshhold * (!vertical ? slideWidth : slideHeight)
        ) {
          if (!trackRef.current) {
            return;
          }

          setAnimationFlag(true);
          trackRef.current.style.transform = !vertical
            ? `translateX(${trackTranslate}px)`
            : `translateY(${trackTranslate}px)`;
        } else {
          changeSlide({ message: slideDistance < 0 ? 'next' : 'prev' });
        }
      },
      [
        vertical,
        threshhold,
        slideWidth,
        slideHeight,
        trackTranslate,
        animationPaused,
        currentSlide,
        React.Children.count(children),
        infinite,
      ],
    );

    const transitionEnd = useCallback(() => {
      // 在禁用动画、动画状态为暂停的情况下，将slide切换到对应的非clone部分
      setAnimationPaused(true);
      setAnimationFlag(false);

      if (currentSlide > React.Children.count(children) - 1 || currentSlide < 0) {
        setCurrentSlide(
          (currentSlide + React.Children.count(children)) % React.Children.count(children),
        );
      }
    }, [currentSlide, React.Children.count(children)]);

    useEffect(() => {
      if (!autoplay) {
        return;
      }

      if (typeof autoplayTimerRef.current !== 'undefined') {
        clearInterval(autoplayTimerRef.current);
      }

      autoplayTimerRef.current = setInterval(
        () => changeSlide({ message: 'next' }),
        autoplayInterval,
      );
    }, [autoplay, currentSlide, animationPaused]);

    useImperativeHandle<TrackRef, {}>(
      ref,
      () => {
        return {
          next: () => changeSlide({ message: 'next' }),
          prev: () => changeSlide({ message: 'prev' }),
          goTo: (slideNumber: number) => changeSlide({ message: 'index', index: slideNumber }),
        };
      },
      [animationPaused, currentSlide, React.Children.count(children), infinite],
    );

    return (
      <div
        ref={trackRef}
        className={classnames(`${PREFIX_CLS}-track`, {
          [`${PREFIX_CLS}-track-vertical`]: vertical,
          [`${PREFIX_CLS}-track-animation`]: animationFlag,
        })}
        style={trackStyle}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
        onTransitionEnd={transitionEnd}
      >
        {renderSlides()}
      </div>
    );
  },
);

export default Track;
