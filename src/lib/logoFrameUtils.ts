// Utility functions for logo frame styling with glassmorphism effect
export type LogoFrameType = 'circle' | 'rounded' | 'none';
export type LogoZoomSize = 'small' | 'medium' | 'large' | 'xlarge';
// Container size options for larger display
export type LogoContainerSize = 'default' | 'large' | 'xlarge' | 'xxlarge';

export interface LogoFrameStyles {
  containerClasses: string;
  imageClasses: string;
  iconClasses: string;
  iconContainerClasses: string;
}

// Frame shape classes with glassmorphism effect
const FRAME_CLASSES: Record<LogoFrameType, string> = {
  circle: 'rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-md shadow-xl border border-white/30 dark:border-white/20',
  rounded: 'rounded-2xl bg-white/20 dark:bg-white/10 backdrop-blur-md shadow-xl border border-white/30 dark:border-white/20',
  none: '',
};

// Zoom percentages for logo within frame (max 100%)
const ZOOM_PERCENTAGES: Record<LogoZoomSize, { logo: string; icon: string }> = {
  'small': { logo: 'h-[70%] w-[70%]', icon: 'h-[50%] w-[50%]' },
  'medium': { logo: 'h-[85%] w-[85%]', icon: 'h-[60%] w-[60%]' },
  'large': { logo: 'h-[95%] w-[95%]', icon: 'h-[70%] w-[70%]' },
  'xlarge': { logo: 'h-full w-full', icon: 'h-[80%] w-[80%]' },
};

// Container size mappings
const CONTAINER_SIZES: Record<LogoContainerSize, { header: string; splash: string; footer: string; card: string }> = {
  'default': { header: 'h-9 w-9 md:h-10 md:w-10', splash: 'h-28 w-28', footer: 'h-8 w-8', card: 'h-12 w-12' },
  'large': { header: 'h-11 w-11 md:h-12 md:w-12', splash: 'h-36 w-36', footer: 'h-10 w-10', card: 'h-14 w-14' },
  'xlarge': { header: 'h-14 w-14 md:h-16 md:w-16', splash: 'h-44 w-44', footer: 'h-12 w-12', card: 'h-16 w-16' },
  'xxlarge': { header: 'h-16 w-16 md:h-20 md:w-20', splash: 'h-52 w-52', footer: 'h-14 w-14', card: 'h-20 w-20' },
};

// Helper to get container size for different contexts
export function getContainerSize(containerSize: LogoContainerSize, context: 'header' | 'splash' | 'footer' | 'card' = 'header'): string {
  return CONTAINER_SIZES[containerSize]?.[context] || CONTAINER_SIZES.default[context];
}

/**
 * Get logo frame styles based on frame type and zoom size
 * Uses glassmorphism effect for a modern look
 * @param frame - Frame type (circle, rounded, none)
 * @param zoom - Zoom size (small, medium, large, extra-large)
 * @param containerSize - Container size class (e.g., 'h-16 w-16', 'h-28 w-28')
 */
export function getLogoFrameStyles(
  frame: LogoFrameType = 'circle',
  zoom: LogoZoomSize = 'medium',
  containerSize: string = 'h-16 w-16'
): LogoFrameStyles {
  const frameClass = FRAME_CLASSES[frame] || FRAME_CLASSES.circle;
  // Normalize old zoom values to valid ones
  const normalizedZoom = normalizeZoomValue(zoom);
  const zoomStyles = ZOOM_PERCENTAGES[normalizedZoom] || ZOOM_PERCENTAGES.medium;

  // For 'none' frame, don't add any container styling except shadow
  const containerStyle = frame === 'none' 
    ? `${containerSize} drop-shadow-lg flex items-center justify-center overflow-hidden`
    : `${containerSize} ${frameClass} flex items-center justify-center overflow-hidden`;

  return {
    containerClasses: containerStyle,
    imageClasses: `${zoomStyles.logo} object-contain`,
    iconClasses: 'text-primary',
    iconContainerClasses: `${zoomStyles.icon} flex items-center justify-center`,
  };
}

// Helper to normalize old zoom values (120, 150, 175, 200) to valid ones
function normalizeZoomValue(zoom: string): LogoZoomSize {
  const validZooms: LogoZoomSize[] = ['small', 'medium', 'large', 'xlarge'];
  if (validZooms.includes(zoom as LogoZoomSize)) {
    return zoom as LogoZoomSize;
  }
  // Map old percentage values to xlarge (100%)
  if (['120', '150', '175', '200', 'extra-large'].includes(zoom)) {
    return 'xlarge';
  }
  return 'medium';
}

/**
 * Get simplified logo frame styles for print/download contexts (white background)
 */
export function getLogoFrameStylesForPrint(
  frame: LogoFrameType = 'circle',
  containerSize: string = 'h-16 w-16'
): LogoFrameStyles {
  const frameShapeOnly: Record<LogoFrameType, string> = {
    circle: 'rounded-full bg-gray-50 shadow-md border border-gray-200',
    rounded: 'rounded-xl bg-gray-50 shadow-md border border-gray-200',
    none: '',
  };

  const containerStyle = frame === 'none'
    ? `${containerSize} flex items-center justify-center overflow-hidden`
    : `${containerSize} ${frameShapeOnly[frame]} flex items-center justify-center overflow-hidden`;

  return {
    containerClasses: containerStyle,
    imageClasses: 'h-[85%] w-[85%] object-contain',
    iconClasses: 'text-primary',
    iconContainerClasses: 'h-[60%] w-[60%] flex items-center justify-center',
  };
}

/**
 * Get logo frame styles for card context (on gradient/colored background)
 */
export function getLogoFrameStylesForCard(
  frame: LogoFrameType = 'circle',
  containerSize: string = 'h-12 w-12'
): LogoFrameStyles {
  const frameShapeOnly: Record<LogoFrameType, string> = {
    circle: 'rounded-full bg-white/20 backdrop-blur-sm border border-white/30',
    rounded: 'rounded-lg bg-white/20 backdrop-blur-sm border border-white/30',
    none: '',
  };

  const containerStyle = frame === 'none'
    ? `${containerSize} drop-shadow-lg flex items-center justify-center overflow-hidden`
    : `${containerSize} ${frameShapeOnly[frame]} flex items-center justify-center overflow-hidden`;

  return {
    containerClasses: containerStyle,
    imageClasses: 'h-[85%] w-[85%] object-contain',
    iconClasses: 'text-white',
    iconContainerClasses: 'h-[60%] w-[60%] flex items-center justify-center',
  };
}

/**
 * Get logo frame styles for splash/landing page (on gradient hero background)
 */
export function getLogoFrameStylesForSplash(
  frame: LogoFrameType = 'circle',
  zoom: LogoZoomSize = 'medium',
  containerSize: string = 'h-28 w-28'
): LogoFrameStyles {
  const frameShapeOnly: Record<LogoFrameType, string> = {
    circle: 'rounded-full bg-white/20 backdrop-blur-md shadow-2xl border border-white/30',
    rounded: 'rounded-3xl bg-white/20 backdrop-blur-md shadow-2xl border border-white/30',
    none: 'drop-shadow-2xl',
  };
  // Normalize old zoom values to valid ones
  const normalizedZoom = normalizeZoomValue(zoom);
  const zoomStyles = ZOOM_PERCENTAGES[normalizedZoom] || ZOOM_PERCENTAGES.medium;

  const containerStyle = frame === 'none'
    ? `${containerSize} drop-shadow-2xl flex items-center justify-center overflow-hidden`
    : `${containerSize} ${frameShapeOnly[frame]} flex items-center justify-center overflow-hidden`;

  return {
    containerClasses: containerStyle,
    imageClasses: `${zoomStyles.logo} object-contain`,
    iconClasses: 'text-white',
    iconContainerClasses: `${zoomStyles.icon} flex items-center justify-center`,
  };
}
