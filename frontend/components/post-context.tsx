"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback } from "react"
import { useWeb3 } from "@/components/web3-provider"
import { useToast } from "@/components/ui/use-toast"

// Define the comment type
export interface Comment {
  id: string
  postId: string
  content: string
  author: {
    address: string
    username: string
    avatar: string
  }
  createdAt: string
}

// Define the post type
export interface Post {
  id: string
  title: string
  content: string
  author: {
    address: string
    username: string
    avatar: string
  }
  createdAt: string
  upvotes: number
  downvotes: number
  commentCount: number
  shareCount: number
  tokenId: string
  isMinted: boolean
  imageUrl?: string // Add optional imageUrl field
  txHash?: string // Add optional transaction hash field
}

// Update the INITIAL_POSTS to include a post with an image
const INITIAL_POSTS = [
  {
    id: "1",
    title: "Introducing Liber: The Future of Social Media",
    content:
      "Today we're launching the first truly decentralized social media platform where every post is an NFT. Join us in revolutionizing how we connect online!",
    author: {
      address: "0x1234...5678",
      username: "founder",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date().toISOString(),
    upvotes: 42,
    downvotes: 3,
    commentCount: 7,
    shareCount: 12,
    tokenId: "1",
    isMinted: true,
  },
  {
    id: "2",
    title: "How NFTs are Changing Digital Ownership",
    content:
      "NFTs provide verifiable ownership of digital assets. On Liber, your content truly belongs to you - it can't be censored or removed by a central authority.",
    author: {
      address: "0xabcd...ef01",
      username: "crypto_enthusiast",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    upvotes: 28,
    downvotes: 2,
    commentCount: 5,
    shareCount: 8,
    tokenId: "2",
    isMinted: true,
  },
  {
    id: "4", // Adding a new post with an image
    title: "My First NFT Collection Launch",
    content:
      "Just launched my first NFT collection on the blockchain! Check out this preview image of one of the pieces.",
    imageUrl: "/placeholder.svg?height=400&width=600",
    author: {
      address: "0x7890...1234",
      username: "nft_creator",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    upvotes: 56,
    downvotes: 0,
    commentCount: 8,
    shareCount: 15,
    tokenId: "4",
    isMinted: true,
  },
  {
    id: "3",
    title: "Web3 Development Tips and Tricks",
    content:
      "Building on the blockchain requires a different mindset. Here are some lessons I've learned while developing dApps that might help you on your journey.",
    author: {
      address: "0x7890...1234",
      username: "web3_dev",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    upvotes: 35,
    downvotes: 1,
    commentCount: 12,
    shareCount: 6,
    tokenId: "3",
    isMinted: true,
  },
]

// Initial comments
const INITIAL_COMMENTS: Comment[] = [
  {
    id: "comment-1",
    postId: "1",
    content: "This is revolutionary! Can't wait to see how it develops.",
    author: {
      address: "0x7890...1234",
      username: "web3_dev",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "comment-2",
    postId: "1",
    content: "I've been waiting for something like this. Traditional social media has too many problems.",
    author: {
      address: "0xabcd...ef01",
      username: "crypto_enthusiast",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "comment-3",
    postId: "2",
    content: "Great explanation of NFTs. This helped me understand the concept better.",
    author: {
      address: "0x7890...1234",
      username: "web3_dev",
      avatar: "/placeholder.svg?height=50&width=50",
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

interface PostContextType {
  posts: Post[]
  addPost: (post: Post) => void
  updatePost: (postId: string, updates: Partial<Post>) => void
  userPosts: Post[]
  isLoading: boolean
  comments: Comment[]
  addComment: (comment: Comment) => void
  getPostComments: (postId: string) => Comment[]
  incrementShareCount: (postId: string) => void
  mintPost: (postId: string) => Promise<void>
  fetchNextPage: () => Promise<void>
  hasMore: boolean
  isFetchingNextPage: boolean
  fetchPostComments: (postId: string) => Promise<Comment[]>
}

const PostContext = createContext<PostContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY_POSTS = "liber_posts"
const LOCAL_STORAGE_KEY_COMMENTS = "liber_comments"

export function PostProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS)
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const { account, mintNFT, isCorrectNetwork } = useWeb3()
  const { toast } = useToast()
  const [commentsByPost, setCommentsByPost] = useState<{ [postId: string]: Comment[] }>({})

  // Fetch posts paginated
  const fetchPosts = async (pageNum = 1, append = false) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/posts?page=${pageNum}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const backendPosts = data.posts || [];
        
        // Transform backend posts to match frontend Post interface
        const transformedPosts = backendPosts.map((post: any) => ({
          id: post._id || post.id,
          title: post.title || "Untitled Post", // Add default title if not present
          content: post.content,
          author: {
            address: post.user?.walletAddress || "Unknown",
            username: post.user?.username || "User",
            avatar: post.user?.avatar || "/placeholder.svg",
          },
          createdAt: post.createdAt,
          upvotes: post.upvotes || 0,
          downvotes: post.downvotes || 0,
          commentCount: post.commentCount || 0,
          shareCount: post.shares || 0,
          tokenId: post.nftTokenId || "",
          isMinted: !!post.nftTokenId,
          imageUrl: post.image,
          txHash: post.txHash,
        }));
        
        setHasMore(pageNum < data.pages);
        setPage(pageNum);
        setPosts((prev) => append ? [...prev, ...transformedPosts] : transformedPosts);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch posts from backend:", error);
    }
    setIsLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchPosts(1, false);
    // eslint-disable-next-line
  }, []);

  // Fetch next page for infinite scroll
  const fetchNextPage = async () => {
    if (isFetchingNextPage || !hasMore) return;
    setIsFetchingNextPage(true);
    await fetchPosts(page + 1, true);
    setIsFetchingNextPage(false);
  };

  // Save posts to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_POSTS, JSON.stringify(posts))
      } catch (error) {
        console.error("Failed to save posts to localStorage:", error)
      }
    }
  }, [posts, isLoading])

  // Save comments to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_COMMENTS, JSON.stringify(comments))
      } catch (error) {
        console.error("Failed to save comments to localStorage:", error)
      }
    }
  }, [comments, isLoading])

  const addPost = (post: Post) => {
    setPosts((prevPosts) => [post, ...prevPosts])
  }

  const updatePost = (postId: string, updates: Partial<Post>) => {
    setPosts((prevPosts) => prevPosts.map((post) => (post.id === postId ? { ...post, ...updates } : post)))
  }

  const addComment = (comment: Comment) => {
    setComments((prevComments) => [...prevComments, comment])

    // Add comment to the commentsByPost cache
    setCommentsByPost((prev) => ({
      ...prev,
      [comment.postId]: [...(prev[comment.postId] || []), comment]
    }))

    // Update the comment count on the post
    updatePost(comment.postId, {
      commentCount: posts.find((p) => p.id === comment.postId)?.commentCount + 1 || 1,
    })
  }

  // Fetch comments for a post from backend
  const fetchPostComments = useCallback(async (postId: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/comment/post/${postId}`);
      if (res.ok) {
        const backendComments = await res.json();
        
        // Transform backend comments to match frontend Comment interface
        const transformedComments = backendComments.map((comment: any) => ({
          id: comment._id || comment.id,
          postId: comment.post,
          content: comment.content,
          author: {
            address: comment.user?.walletAddress || "Unknown",
            username: comment.user?.username || "User",
            avatar: comment.user?.avatar || "/placeholder.svg",
          },
          createdAt: comment.createdAt,
        }));
        
        setCommentsByPost((prev) => ({ ...prev, [postId]: transformedComments }));
        return transformedComments;
      }
    } catch (error) {
      console.error("Failed to fetch comments from backend:", error);
    }
    return [];
  }, []);

  // Get comments for a post (from cache)
  const getPostComments = (postId: string) => {
    return (
      commentsByPost[postId] || []
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const incrementShareCount = (postId: string) => {
    updatePost(postId, {
      shareCount: posts.find((p) => p.id === postId)?.shareCount + 1 || 1,
    })
  }

  const mintPost = async (postId: string): Promise<void> => {
    if (!account) {
      throw new Error("Wallet not connected")
    }

    const post = posts.find((p) => p.id === postId)
    if (!post) {
      throw new Error("Post not found")
    }

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      const res = await fetch(`${apiBaseUrl}/api/nft/mint/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to mint NFT on backend')
      const data = await res.json()
      updatePost(postId, {
        isMinted: true,
        tokenId: data.tokenId,
        txHash: data.post?.txHash || '',
      })
      toast({
        title: "NFT Minted Successfully",
        description: "Your post has been minted as an NFT.",
      })
    } catch (error: any) {
      toast({
        title: "Minting failed",
        description: error.message || "Failed to mint NFT",
        variant: "destructive",
      })
      throw error
    }
  }

  // Filter posts by the current user's address
  const userPosts = posts.filter(
    (post) =>
      account &&
      post.author &&
      post.author.address &&
      post.author.address.toLowerCase() === account.toLowerCase()
  )

  return (
    <PostContext.Provider
      value={{
        posts,
        addPost,
        updatePost,
        userPosts,
        isLoading,
        comments,
        addComment,
        getPostComments,
        incrementShareCount,
        mintPost,
        fetchNextPage,
        hasMore,
        isFetchingNextPage,
        fetchPostComments,
      }}
    >
      {children}
    </PostContext.Provider>
  )
}

export function usePosts() {
  const context = useContext(PostContext)
  if (context === undefined) {
    throw new Error("usePosts must be used within a PostProvider")
  }
  return context
}

