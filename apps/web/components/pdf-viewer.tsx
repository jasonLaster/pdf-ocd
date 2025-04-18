"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useResizeDetector } from "react-resize-detector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  AlertTriangle,
  Layers,
  EyeOff,
  Search,
  MoreVertical,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FloatingPdfChat } from "@/components/floating-pdf-chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import just the type for TypeScript
import type { PdfViewerContentProps } from "./pdf-viewer-content";

// Configuration - use simple options for reliability
const options = {
  cMapUrl: "https://unpkg.com/pdfjs-dist@4.8.69/cmaps/",
  cMapPacked: true,
};

const maxWidth = 800;
const thumbnailWidth = 150;

interface PdfViewerProps {
  pdfUrl: string;
  pdfTitle?: string;
  onError?: () => void;
}

// Lazy load the PDF viewer content - use a cast to fix TS issues
const PdfViewerContent = lazy(() =>
  import("./pdf-viewer-content").then((module) => ({
    default: module.PdfViewerContent,
  }))
) as React.FC<PdfViewerContentProps>;

// Create a loading fallback component for PDF document
function DocumentLoadingFallback() {
  return (
    <div className="flex flex-col w-full h-full bg-white rounded-lg overflow-hidden animate-pulse">
      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
        <div className="h-6 w-[50%] bg-gray-100 rounded"></div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-[180px] border-r bg-gray-50 p-2 flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
          <div className="w-full max-w-3xl h-[800px] bg-gray-200 rounded mb-4"></div>
          <div className="w-full max-w-3xl h-[800px] bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function PdfViewer({
  pdfUrl,
  pdfTitle = "Document",
  onError,
}: PdfViewerProps) {
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showTextLayer, setShowTextLayer] = useState<boolean>(false);
  const [isManualPageChange, setIsManualPageChange] = useState<boolean>(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const [searchText, setSearchText] = useState<string>("");
  const [documentLoaded, setDocumentLoaded] = useState<boolean>(false);

  // Initialize PDF.js worker - doing this early
  useEffect(() => {
    // Preload the PDF viewer content component
    import("./pdf-viewer-content");
  }, []);

  // Manual resize observer implementation instead of using the hook
  useEffect(() => {
    if (!containerRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Track visible page based on scroll position
  useEffect(() => {
    if (!mainContentRef.current || numPages === 0) return;

    const handleScroll = () => {
      // Skip scroll handling if we're in a manual page change
      if (!mainContentRef.current || isManualPageChange) return;

      // Clear any existing timeout to debounce scroll events
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use a small timeout to avoid excessive updates while scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        if (!mainContentRef.current) return;

        const scrollPosition = mainContentRef.current.scrollTop;
        const viewportHeight = mainContentRef.current.clientHeight;
        const pageContainers = Array.from(
          document.querySelectorAll(".pdf-page-container")
        );

        // Find the page that is most visible in the viewport
        let bestVisiblePage = 1;
        let maxVisibleArea = 0;

        for (let i = 0; i < pageContainers.length; i++) {
          const container = pageContainers[i] as HTMLElement;
          const rect = container.getBoundingClientRect();
          const mainContentRect =
            mainContentRef.current.getBoundingClientRect();

          // Calculate how much of the page is visible
          const top = Math.max(rect.top, mainContentRect.top);
          const bottom = Math.min(rect.bottom, mainContentRect.bottom);
          const visibleHeight = Math.max(0, bottom - top);

          // Get page number from element id
          const pageId = container.id;
          const pageNum = parseInt(pageId.replace("page-", ""));

          // Update if this page has more visible area than previous best
          if (visibleHeight > maxVisibleArea) {
            maxVisibleArea = visibleHeight;
            bestVisiblePage = pageNum;
          }
        }

        // Only update when page changes to avoid unnecessary re-renders
        if (bestVisiblePage !== currentPage) {
          setCurrentPage(bestVisiblePage);

          // Update sidebar scroll position to show current page
          const sidebarItem = document.querySelector(
            `[data-page-thumb="${bestVisiblePage}"]`
          );
          if (sidebarItem) {
            sidebarItem.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }

          // Update URL without page reload
          const url = new URL(window.location.href);
          url.searchParams.set("page", bestVisiblePage.toString());
          window.history.replaceState({}, "", url.toString());
        }
      }, 100); // Short debounce time for better responsiveness
    };

    const scrollContainer = mainContentRef.current;
    scrollContainer.addEventListener("scroll", handleScroll);

    // Initial check after a delay to ensure PDF has rendered
    const initialCheckTimeout = setTimeout(handleScroll, 500);

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
      // Clean up timeouts
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      clearTimeout(initialCheckTimeout);
    };
  }, [mainContentRef, currentPage, numPages, isManualPageChange]);

  useEffect(() => {
    // Reset page number when PDF URL changes
    setCurrentPage(1);
  }, [pdfUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setDocumentLoaded(true);
  }

  function onDocumentLoadError(error: Error) {
    console.error("Error loading PDF:", error);
    setPdfLoadError(error.message);

    toast({
      title: "Error loading PDF",
      description: error.message,
      variant: "destructive",
    });

    if (onError) onError();
  }

  const changePage = (offset: number) => {
    const newPageNumber = currentPage + offset;
    if (newPageNumber >= 1 && newPageNumber <= numPages) {
      goToPage(newPageNumber);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      // Set flag to prevent scroll detection from overriding manual navigation
      setIsManualPageChange(true);
      setCurrentPage(page);

      // Scroll to the selected page
      if (mainContentRef.current) {
        const targetElement = document.getElementById(`page-${page}`);
        if (targetElement) {
          // Use smooth scrolling for better UX
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });

          // Reset the manual page change flag after scrolling finishes
          setTimeout(() => {
            setIsManualPageChange(false);
          }, 800); // Allow time for the scroll animation to complete
        } else {
          // If we can't find the target element yet (still loading), wait and try again
          setTimeout(() => {
            const retryElement = document.getElementById(`page-${page}`);
            if (retryElement) {
              retryElement.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
            setIsManualPageChange(false);
          }, 500);
        }
      } else {
        // If no main content ref, just reset the flag
        setTimeout(() => {
          setIsManualPageChange(false);
        }, 500);
      }
    }
  };

  const handleZoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.2, 0.5));
  };

  const handleRotate = () => {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  };

  const handleDownload = () => {
    if (!pdfUrl.startsWith("http") && !pdfUrl.startsWith("/")) {
      toast({
        title: "Download error",
        description: "Cannot download this PDF",
        variant: "destructive",
      });
      return;
    }

    // Open the PDF in a new tab for download
    window.open(pdfUrl, "_blank");
  };

  const toggleThumbnails = () => {
    setShowThumbnails((prev) => !prev);
  };

  const toggleTextLayer = () => {
    setShowTextLayer((prev) => !prev);
  };

  // If we have a PDF error, show a fallback UI
  if (pdfLoadError) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b bg-muted/20">
          <h2 className="font-medium">{pdfTitle}</h2>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Open in New Tab
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-gray-100">
          <div className="max-w-md p-6 bg-white rounded-lg shadow-md text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">PDF Viewer Issue</h3>
            <p className="mb-4 text-gray-600">
              {`We couldn't load this PDF: ${pdfLoadError}`}
            </p>
            <Button onClick={handleDownload}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Open PDF in New Tab
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate width to display page with
  const pageWidth = containerWidth
    ? Math.min(containerWidth - (showThumbnails ? 180 : 0), maxWidth)
    : maxWidth;

  // Generate array of page numbers for rendering thumbnails
  const pageNumbers = Array.from({ length: numPages }, (_, index) => index + 1);

  // Extract PDF ID from URL or use the one from props
  const pdfId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id") ||
        window.location.pathname.split("/").pop() ||
        "0"
      : "0";

  // Convert to number for the chat component
  const pdfIdNumber = parseInt(pdfId, 10);

  return (
    <div
      data-document-loaded={documentLoaded}
      className="flex flex-col h-full bg-white rounded-lg overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <h2 className="font-medium">{pdfTitle}</h2>
        </div>

        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleThumbnails}>
                <Layers
                  className={`h-4 w-4 mr-2 ${
                    showThumbnails ? "text-blue-500" : ""
                  }`}
                />
                {showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTextLayer}>
                <EyeOff
                  className={`h-4 w-4 mr-2 ${
                    !showTextLayer ? "text-blue-500" : ""
                  }`}
                />
                {showTextLayer ? "Hide text layer" : "Show text layer"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleZoomOut} disabled={scale <= 0.5}>
                <ZoomOut className="h-4 w-4 mr-2" />
                Zoom out
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleZoomIn} disabled={scale >= 3}>
                <ZoomIn className="h-4 w-4 mr-2" />
                Zoom in
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRotate}>
                <RotateCw className="h-4 w-4 mr-2" />
                Rotate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content area with optional sidebar */}
      <div className="flex-1 flex overflow-hidden" ref={setContainerRef}>
        <Suspense fallback={<DocumentLoadingFallback />}>
          <PdfViewerContent
            pdfUrl={pdfUrl}
            numPages={numPages}
            currentPage={currentPage}
            scale={scale}
            rotation={rotation}
            showThumbnails={showThumbnails}
            showTextLayer={showTextLayer}
            isManualPageChange={isManualPageChange}
            mainContentRef={mainContentRef}
            pageWidth={pageWidth}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            onDocumentLoadError={onDocumentLoadError}
            goToPage={goToPage}
            changePage={changePage}
            handleDownload={handleDownload}
          />
        </Suspense>
      </div>

      {/* Floating Chat Component */}
      <FloatingPdfChat
        pdfId={pdfIdNumber}
        pdfTitle={pdfTitle}
        pdfUrl={pdfUrl}
        onClose={() => {}}
      />
    </div>
  );
}
