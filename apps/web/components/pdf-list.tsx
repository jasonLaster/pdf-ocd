"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import {
  FileIcon,
  SearchIcon,
  TrashIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  SortAscIcon,
  Trash2,
  Building,
  Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAtom, useAtomValue } from "jotai";
import {
  pdfsAtom,
  pdfsLoadingAtom,
  pdfsErrorAtom,
  fetchPdfsAtom,
  searchQueryAtom,
  metadataFilterAtom,
  PDF,
} from "@/lib/store";

export function PdfList() {
  const pdfs = useAtomValue(pdfsAtom);
  const loading = useAtomValue(pdfsLoadingAtom);
  const error = useAtomValue(pdfsErrorAtom);
  const [, fetchPdfs] = useAtom(fetchPdfsAtom);
  const searchQuery = useAtomValue(searchQueryAtom);
  const metadataFilter = useAtomValue(metadataFilterAtom);
  const { toast } = useToast();
  const router = useRouter();
  const { organization } = useOrganization();

  useEffect(() => {
    fetchPdfs();
  }, [fetchPdfs, organization?.id]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading PDFs",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/pdfs/${id}/delete`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete PDF");
      }

      fetchPdfs();

      toast({
        title: "PDF deleted",
        description: "The PDF has been deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to delete the PDF",
        variant: "destructive",
      });
    }
  };

  // Filter PDFs based on both search query and metadata filter
  const filteredPdfs = pdfs.filter((pdf) => {
    // First apply text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        pdf.title?.toLowerCase().includes(query) ||
        false ||
        pdf.name.toLowerCase().includes(query) ||
        pdf.description?.toLowerCase().includes(query) ||
        false;

      if (!matchesSearch) return false;
    }

    // Then apply metadata filter if active
    if (metadataFilter.type && metadataFilter.value) {
      const metadata = (pdf as any).metadata;

      if (metadataFilter.type === "label") {
        // Check if the PDF has this label
        return (
          metadata?.labels &&
          Array.isArray(metadata.labels) &&
          metadata.labels.includes(metadataFilter.value)
        );
      }

      if (metadataFilter.type === "company") {
        // Check if the PDF is from this company
        return metadata?.issuingOrganization === metadataFilter.value;
      }
    }

    // If no metadata filter or it passed the filter
    return true;
  });

  if (loading) {
    return (
      <div data-testid="pdf-list-loading" className="animate-pulse space-y-4">
        <div className="h-10 bg-muted/50 rounded-md w-full"></div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted/30 rounded-md w-full"></div>
        ))}
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>Error loading PDFs: {error}</p>
        <Button onClick={() => fetchPdfs()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (pdfs.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <FileIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium mb-2">No PDFs found</h2>
        <p className="text-muted-foreground mb-4">
          Upload your first PDF to get started
        </p>
        <div className="flex justify-center gap-4">
          <FileUpload dropZoneOnly={true} className="w-auto" />
        </div>
      </div>
    );
  }

  if (filteredPdfs.length === 0 && pdfs.length > 0 && !loading) {
    // Determine appropriate message based on active filters
    let filterMessage: React.ReactNode = "";

    if (metadataFilter.type && metadataFilter.value) {
      const filterType = metadataFilter.type === "label" ? "label" : "company";
      const filterIcon =
        metadataFilter.type === "label" ? (
          <Tag className="h-4 w-4 mx-1 inline" />
        ) : (
          <Building className="h-4 w-4 mx-1 inline" />
        );

      filterMessage = (
        <>
          No PDFs match the {filterType} {filterIcon}
          <span className="font-medium">"{metadataFilter.value}"</span>
          {searchQuery && ' and search query "' + searchQuery + '"'}
        </>
      );
    } else if (searchQuery) {
      filterMessage = <>No PDFs match your search for "{searchQuery}"</>;
    }

    return (
      <div className="text-center py-12">
        <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium mb-2">No matching PDFs</h2>
        <p className="text-muted-foreground mb-4">{filterMessage}</p>
        <Button variant="outline" onClick={() => router.refresh()}>
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="pdf-list" className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60%]">
              <div className="flex items-center gap-1">
                Name <SortAscIcon className="h-3 w-3 ml-1" />
              </div>
            </TableHead>
            <TableHead>Last modified</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPdfs.map((pdf) => (
            <PdfListItem key={pdf.id} pdf={pdf} handleDelete={handleDelete} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PdfListItem({
  pdf,
  handleDelete,
}: {
  pdf: PDF;
  handleDelete: (id: number) => void;
}) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return (
    <TableRow key={pdf.id} className="hover:bg-muted/50 cursor-pointer">
      <TableCell className="font-medium">
        <Link
          data-testid="pdf-list-item"
          href={`/pdfs/${pdf.id}`}
          className="flex items-center gap-2"
        >
          <FileIcon className="h-5 w-5 text-blue-500" />
          <span className="truncate">{pdf.title || pdf.name}</span>
        </Link>
      </TableCell>
      <TableCell>{formatDate(pdf.uploadedAt)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/pdfs/${pdf.id}`)}>
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/chat?pdf=${pdf.id}`)}
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Chat with PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/search?pdf=${pdf.id}`)}
            >
              <SearchIcon className="h-4 w-4 mr-2" />
              Search Inside
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(pdf.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">
                Delete &quot;{pdf.title || pdf.name}&quot;
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
