import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getErrorMessage, formatCookTime } from '../../utils/helpers';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

// ── Post type config ───────────────────────────────────────────
const POST_TYPES = {
  question: { label: 'Question',     emoji: '❓', color: 'text-blue-400',   border: 'border-blue-500/20',  bg: 'bg-blue-900/10'  },
  log:      { label: 'Cooking Log',  emoji: '📝', color: 'text-sage-l',     border: 'border-sage/20',      bg: 'bg-[rgba(74,124,89,0.08)]' },
  draft:    { label: 'Recipe Draft', emoji: '🧪', color: 'text-gold',       border: 'border-gold/20',      bg: 'bg-[rgba(212,168,67,0.08)]' },
};

export default function CommunityDetailPage() {
  const { id }   = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [feed,      setFeed]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setTab]       = useState('wall');
  const [joining,   setJoining]   = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);
  const [editName,  setEditName]  = useState('');
  const [editDesc,  setEditDesc]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [showDeleteCommunityModal, setShowDeleteCommunityModal] = useState(false);
  const [deleteMemberTarget, setDeleteMemberTarget] = useState(null);
  const loadFeed = async () => {
    try {
      const { data } = await api.get(`/communities/${id}/feed`);
      setFeed(data.feed || []);
    } catch { }
  };
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/communities/${id}`);
        setCommunity(data);
        setEditName(data.name || '');
        setEditDesc(data.description || '');
      } catch (err) { toast.error(getErrorMessage(err)); }
      finally { setLoading(false); }
    };
    load();
    loadFeed();
  }, [id]);

  // ── Community actions ────────────────────────────────────────
  const handleJoin = async () => {
    if (!user) return navigate('/login');
    setJoining(true);
    try {
      await api.post(`/communities/${id}/join`);
      setCommunity(prev => ({ ...prev, isMember: true, _count: { ...prev._count, members: (prev._count?.members || 0) + 1 } }));
      toast.success(`Joined ${community.name}!`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setJoining(false); }
  };
  const handleLeave = async () => {
    setJoining(true);
    try {
      await api.delete(`/communities/${id}/leave`);
      setCommunity(prev => ({ ...prev, isMember: false, _count: { ...prev._count, members: Math.max((prev._count?.members || 1) - 1, 0) } }));
      toast.success('Left community');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setJoining(false); }
  };
  const handleDeleteCommunity = async () => {
    try {
      await api.delete(`/communities/${id}`);
      navigate('/communities');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/communities/${id}`, { name: editName.trim(), description: editDesc.trim() });
      setCommunity(prev => ({ ...prev, name: data.community.name, description: data.community.description }));
      setShowEdit(false);
      toast.success('Updated');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };
  const handleKick = async (memberId, name) => {
    try {
      await api.delete(`/communities/${id}/members/${memberId}`);
      setCommunity(prev => ({ ...prev, members: prev.members.filter(m => m.user.id !== memberId) }));
      toast.success(`${name} removed`);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };
  const handleDeletePost = async (item) => {
    try {
      await api.delete(`/communities/${id}/posts/${item.dbId}`);
      setFeed(prev => prev.filter(f => f.id !== item.id));
    } catch (err) { toast.error(getErrorMessage(err)); }
  };
  const onPostCreated = (newItem) => {
    setFeed(prev => [newItem, ...prev]);
  };
  if (loading) return (
    <div className="max-w-4xl mx-auto animate-pulse space-y-4">
      <div className="h-36 bg-forest2 rounded-2xl"/>
      <div className="h-10 bg-forest2 rounded-xl w-64"/>
      <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 bg-forest2 rounded-2xl"/>)}</div>
    </div>
  );
  if (!community) return null;
  const isCreator = user?.id === community.creatorId;
  const isAdmin   = user?.role === 'ADMIN';
  const isMember  = community.isMember;
  const canAdmin  = isCreator || isAdmin;
  return (
    <div className="max-w-4xl mx-auto anim-up">
      {/* Back */}
      <button onClick={() => navigate('/communities')}
              className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-5 transition-colors">
        <BackIcon/> Communities
      </button>
      {/* ── Community header ────────────────────────────────── */}
      {!showEdit ? (
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex-shrink-0 bg-gradient-to-br from-sage to-forest3
                            border border-[rgba(74,124,89,0.3)] flex items-center justify-center
                            text-cream text-[26px] font-bold font-serif select-none">
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-[28px] font-light text-cream leading-tight mb-1">{community.name}</h1>
              <p className="text-sm text-muted">
                by{' '}
                <span className="text-sage-l cursor-pointer hover:text-cream transition-colors"
                      onClick={() => navigate(`/users/${community.creator?.id}`)}>
                  {community.creator?.name}
                </span>
                {' · '}<span className="text-cream">{community._count?.members || 0}</span> members
                {' · '}<span className="text-cream">{feed.filter(f => f.kind === 'post').length}</span> posts
              </p>
              {community.description && (
                <p className="text-[14px] text-cream/70 mt-2 leading-relaxed">{community.description}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {!canAdmin && user && (isMember
                ? <Button variant="secondary" size="sm" loading={joining} onClick={handleLeave}>Leave</Button>
                : <Button size="sm" loading={joining} onClick={handleJoin}>Join</Button>
              )}
              {!user && <Button size="sm" onClick={() => navigate('/login')}>Join</Button>}
              {canAdmin && (
                <>
                  <span className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg text-center">
                    {isCreator ? 'Admin' : 'Platform Admin'}
                  </span>
                  <button onClick={() => setShowEdit(true)}
                          className="text-xs text-muted hover:text-cream border border-[rgba(74,124,89,0.25)]
                                     hover:border-sage px-3 py-1.5 rounded-lg transition-all text-center">
                    Edit
                  </button>
                  <button onClick={() => setShowDeleteCommunityModal(true)}
                          className="text-xs text-red-400 border border-red-500/20
                                     px-3 py-1.5 rounded-lg transition-all text-center hover:border-red-400/50">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveEdit}
              className="bg-forest2 border border-[rgba(74,124,89,0.25)] rounded-2xl p-6 mb-6 anim-up">
          <h2 className="font-serif text-xl font-light text-cream mb-4">Edit Community</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                     className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                px-3.5 py-2.5 text-cream text-sm outline-none focus:border-sage transition-colors"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                        className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                   px-3.5 py-2.5 text-cream text-sm outline-none focus:border-sage
                                   transition-colors resize-none"/>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={saving}>Save</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
            </div>
          </div>
        </form>
      )}
      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit border border-[rgba(74,124,89,0.18)]">
        {[
          { id: 'wall',    label: `Wall (${feed.length})` },
          { id: 'members', label: `Members (${community._count?.members || 0})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
                  className={`px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200
                              ${activeTab === tab.id ? 'bg-forest3 text-cream font-medium' : 'text-muted hover:text-cream'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* ── WALL TAB ────────────────────────────────────────── */}
      {activeTab === 'wall' && (
        <div className="flex flex-col gap-4">
          {/* Compose — members only */}
          {isMember
            ? <ComposeBox communityId={id} user={user} onCreated={onPostCreated}/>
            : (
              <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4 text-center">
                <p className="text-sm text-muted mb-2">Join to post and share in this community</p>
                {user
                  ? <Button size="sm" onClick={handleJoin} loading={joining}>Join community</Button>
                  : <Button size="sm" onClick={() => navigate('/login')}>Sign in to join</Button>
                }
              </div>
            )
          }
          {/* Feed */}
          {feed.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3 opacity-40">📢</p>
              <p className="font-serif text-lg font-light text-cream mb-1">No posts yet</p>
              <p className="text-sm text-muted">
                {isMember ? 'Be the first to ask a question or share a cooking log' : 'Join to start posting'}
              </p>
            </div>
          ) : (
            feed.map((item, i) => (
              <PostCard
                key={item.id}
                item={item}
                user={user}
                communityId={id}
                canAdmin={canAdmin}
                onDelete={() => handleDeletePost(item)}
                navigate={navigate}
                index={i}
              />
            ))
          )}
        </div>
      )}
      {/* ── MEMBERS TAB ─────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {community.members?.map((member, i) => (
            <div key={member.id}
                 className="flex items-center gap-3 p-3 rounded-xl bg-forest2
                            border border-[rgba(74,124,89,0.18)] anim-up"
                 style={{ animationDelay: `${i * 0.04}s` }}>
              <div onClick={() => navigate(`/users/${member.user.id}`)}
                   className="w-9 h-9 rounded-full flex-shrink-0 bg-gradient-to-br from-sage to-rust
                              flex items-center justify-center text-cream text-[12px] font-bold
                              overflow-hidden cursor-pointer">
                {member.user.avatarURL
                  ? <img src={member.user.avatarURL} alt="" className="w-full h-full object-cover"/>
                  : getInitials(member.user.name)}
              </div>
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/users/${member.user.id}`)}>
                <p className="text-[13px] font-medium text-cream truncate">{member.user.name}</p>
                {community.creatorId === member.user.id && <p className="text-[10px] text-gold">Admin</p>}
              </div>
              {canAdmin && member.user.id !== community.creatorId && member.user.id !== user?.id && (
                <button onClick={() => setDeleteMemberTarget({ id: member.user.id, name: member.user.name })}
                        className="text-[11px] text-muted hover:text-red-400 border border-transparent
                                   hover:border-red-500/20 px-2 py-1 rounded-lg transition-all flex-shrink-0">
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Delete community modal */}
      <ConfirmModal
        isOpen={showDeleteCommunityModal}
        onClose={() => setShowDeleteCommunityModal(false)}
        onConfirm={handleDeleteCommunity}
        title="Delete community"
        message={community ? `"${community.name}" will be permanently deleted.` : ''}
        confirmLabel="Delete community"
        danger
      />
      <ConfirmModal
        isOpen={!!deleteMemberTarget}
        onClose={() => setDeleteMemberTarget(null)}
        onConfirm={async () => {
          if (deleteMemberTarget) {
            await handleKick(deleteMemberTarget.id, deleteMemberTarget.name);
            setDeleteMemberTarget(null);
          }
        }}
        title="Remove member"
        message={deleteMemberTarget ? `Remove ${deleteMemberTarget.name} from this community?` : ''}
        confirmLabel="Remove member"
        danger
      />
    </div>
  );
}

// ── ComposeBox ─────────────────────────────────────────────────
function ComposeBox({ communityId, user, onCreated }) {
  const [postType,     setPostType]     = useState('question');
  const [content,      setContent]      = useState('');
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [ingredients,  setIngredients]  = useState([{ name: '', quantity: '', unit: '' }]);
  const [posting,      setPosting]      = useState(false);
  const fileRef = useRef(null);
  const PLACEHOLDERS = {
    question: 'Ask a question, request advice, or start a discussion about this community\'s topic...',
    log:      'Share how a dish turned out, what you tried, what worked and what didn\'t...',
    draft:    'Describe your recipe idea — what you\'re trying to make and any notes...',
  };
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const addIngredient    = () => setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
  const removeIngredient = (i) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updateIngredient = (i, field, val) =>
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content',  content.trim());
      fd.append('postType', postType);
      if (imageFile) fd.append('image', imageFile);
      if (postType === 'draft') {
        const validIng = ingredients.filter(i => i.name.trim());
        if (validIng.length > 0) fd.append('ingredients', JSON.stringify(validIng));
      }
      const { data } = await api.post(`/communities/${communityId}/posts`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onCreated({
        kind:         'post',
        id:           `post-${data.post.id}`,
        dbId:         data.post.id,
        createdAt:    data.post.createdAt,
        user:         { id: user.id, name: user.name, avatarURL: user.avatarURL, role: user.role },
        content:      data.post.content,
        imageURL:     data.post.imageURL,
        postType:     data.post.postType,
        ingredients:  data.post.ingredients,
        commentCount: 0,
      });
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setIngredients([{ name: '', quantity: '', unit: '' }]);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPosting(false); }
  };
  return (
    <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl overflow-hidden">
      {/* Post type selector */}
      <div className="flex border-b border-[rgba(74,124,89,0.18)]">
        {Object.entries(POST_TYPES).map(([type, config]) => (
          <button key={type} onClick={() => setPostType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium
                              transition-all duration-200 border-b-2
                              ${postType === type
                                ? `border-b-sage ${config.color} bg-[rgba(74,124,89,0.08)]`
                                : 'border-b-transparent text-muted hover:text-cream'}`}>
            <span>{config.emoji}</span>
            <span>{config.label}</span>
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-3 items-start">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full flex-shrink-0 bg-gradient-to-br from-sage to-rust
                          flex items-center justify-center text-cream text-[11px] font-bold overflow-hidden">
            {user?.avatarURL
              ? <img src={user.avatarURL} alt="" className="w-full h-full object-cover"/>
              : getInitials(user?.name)}
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {/* Text area */}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={PLACEHOLDERS[postType]}
              rows={3}
              maxLength={1000}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                         px-4 py-2.5 text-sm text-cream placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
            />
            {/* Image preview */}
            {imagePreview && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-forest3">
                <img src={imagePreview} alt="" className="w-full h-full object-cover"/>
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full
                                   flex items-center justify-center text-sm hover:bg-black/80 transition-colors">
                  ×
                </button>
              </div>
            )}
            {/* Ingredient fields — only for draft type */}
            {postType === 'draft' && (
              <div className="bg-forest rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                    Ingredients (optional)
                  </p>
                  <button type="button" onClick={addIngredient}
                          className="text-[11px] text-sage-l hover:text-cream flex items-center gap-1 transition-colors">
                    <PlusIcon/> Add
                  </button>
                </div>
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                           placeholder="Ingredient"
                           className="flex-1 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-lg
                                      px-2.5 py-1.5 text-cream text-[13px] placeholder:text-muted
                                      outline-none focus:border-sage transition-colors"/>
                    <input value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                           placeholder="Qty" type="number"
                           className="w-14 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-lg
                                      px-2 py-1.5 text-cream text-[13px] placeholder:text-muted
                                      outline-none focus:border-sage transition-colors"/>
                    <input value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                           placeholder="Unit"
                           className="w-16 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-lg
                                      px-2 py-1.5 text-cream text-[13px] placeholder:text-muted
                                      outline-none focus:border-sage transition-colors"/>
                    {ingredients.length > 1 && (
                      <button type="button" onClick={() => removeIngredient(i)}
                              className="text-muted hover:text-red-400 transition-colors px-1">
                        <RemoveIcon/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Actions row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Photo upload */}
                <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 text-[12px] text-muted hover:text-cream
                                   border border-[rgba(74,124,89,0.2)] hover:border-sage
                                   px-3 py-1.5 rounded-lg transition-all">
                  <CameraIcon/> {imageFile ? 'Change photo' : 'Add photo'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden"/>
                <span className="text-[11px] text-muted">{content.length}/1000</span>
              </div>
              <Button type="submit" size="sm" loading={posting} disabled={!content.trim()}>
                Post
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── PostCard ───────────────────────────────────────────────────
function PostCard({ item, user, communityId, canAdmin, onDelete, navigate, index }) {
  const [showComments, setShowComments]   = useState(false);
  const [comments,     setComments]       = useState([]);
  const [commentCount, setCommentCount]   = useState(item.commentCount || 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reply,        setReply]          = useState('');
  const [posting,      setPosting]        = useState(false);
  const [verifiedId,   setVerifiedId]     = useState(null); // commentId of verified answer
  const config   = POST_TYPES[item.postType] || POST_TYPES.question;
  const isAuthor = user?.id === item.user?.id;
  const isMember = !!user; // simplified — if logged in
  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const { data } = await api.get(`/communities/${communityId}/posts/${item.dbId}/comments`);
        setComments(data.comments || []);
      } catch { } finally { setLoadingComments(false); }
    }
    setShowComments(s => !s);
  };
  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/communities/${communityId}/posts/${item.dbId}/comments`, {
        content: reply.trim(),
      });
      setComments(prev => [...prev, data.comment]);
      setCommentCount(c => c + 1);
      setReply('');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPosting(false); }
  };
  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/communities/${communityId}/posts/${item.dbId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(c => Math.max(c - 1, 0));
    } catch (err) { toast.error(getErrorMessage(err)); }
  };
  // Convert to recipe — navigates to /add-recipe with pre-filled state
  const handleConvert = () => {
    navigate('/add-recipe', {
      state: {
        prefill: {
          title:       item.content.split('\n')[0].slice(0, 80),
          description: item.content,
          ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
        },
      },
    });
  };
  return (
    <div className={`bg-forest2 border ${config.border} rounded-2xl overflow-hidden anim-up`}
         style={{ animationDelay: `${index * 0.05}s` }}>
      {/* Post image */}
      {item.imageURL && (
        <div className="w-full h-52 overflow-hidden">
          <img src={item.imageURL} alt="" className="w-full h-full object-cover"/>
        </div>
      )}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div onClick={() => navigate(`/users/${item.user?.id}`)}
               className="w-9 h-9 rounded-full flex-shrink-0 bg-gradient-to-br from-sage to-rust
                          flex items-center justify-center text-cream text-[11px] font-bold
                          overflow-hidden cursor-pointer flex-shrink-0">
            {item.user?.avatarURL
              ? <img src={item.user.avatarURL} alt="" className="w-full h-full object-cover"/>
              : getInitials(item.user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-cream cursor-pointer hover:text-sage-l transition-colors"
                    onClick={() => navigate(`/users/${item.user?.id}`)}>
                {item.user?.name}
              </span>
              {item.user?.role === 'EXPERT' && (
                <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded-md">Expert</span>
              )}
              {/* Post type badge */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${config.color} ${config.bg} border ${config.border}`}>
                {config.emoji} {config.label}
              </span>
              <span className="text-[11px] text-muted">
                {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
          {(isAuthor || canAdmin) && (
            <button onClick={onDelete} className="text-[11px] text-muted hover:text-red-400 transition-colors flex-shrink-0">
              Delete
            </button>
          )}
        </div>
        {/* Content */}
        <p className="text-[14px] text-cream/90 leading-relaxed whitespace-pre-wrap mb-3">
          {item.content}
        </p>
        {/* Ingredients — for drafts */}
        {item.postType === 'draft' && Array.isArray(item.ingredients) && item.ingredients.length > 0 && (
          <div className="bg-forest rounded-xl p-3 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gold mb-2">Ingredients</p>
            <div className="flex flex-col gap-1">
              {item.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
                  <span className="text-cream/80 capitalize">{ing.name}</span>
                  {(ing.quantity || ing.unit) && (
                    <span className="text-muted">{ing.quantity} {ing.unit}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-[rgba(74,124,89,0.12)]">
          {/* Comments toggle */}
          <button onClick={toggleComments}
                  className="flex items-center gap-1.5 text-[12px] text-muted hover:text-cream transition-colors">
            <CommentIcon/>
            {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
          </button>
          {/* Convert to recipe — only author + draft type */}
          {isAuthor && item.postType === 'draft' && (
            <button onClick={handleConvert}
                    className="ml-auto flex items-center gap-1.5 text-[12px] text-gold hover:text-gold-l
                               border border-gold/30 hover:border-gold/60
                               px-3 py-1.5 rounded-lg transition-all">
              <RecipeIcon/> Convert to Recipe
            </button>
          )}
        </div>
        {/* Comment thread */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-[rgba(74,124,89,0.12)] flex flex-col gap-3">
            {loadingComments ? (
              <div className="flex gap-2 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-forest3 flex-shrink-0"/>
                <div className="flex-1 h-10 bg-forest3 rounded-xl"/>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-[12px] text-muted text-center py-2">No replies yet — be the first</p>
            ) : (
              [...comments].sort((a, b) => (b.id === verifiedId ? 1 : 0) - (a.id === verifiedId ? 1 : 0)).map(c => (
                <div key={c.id} className="flex gap-2.5 items-start">
                  <div onClick={() => navigate(`/users/${c.user?.id}`)}
                       className="w-7 h-7 rounded-full flex-shrink-0 bg-gradient-to-br from-sage to-rust
                                  flex items-center justify-center text-cream text-[10px] font-bold
                                  overflow-hidden cursor-pointer">
                    {c.user?.avatarURL
                      ? <img src={c.user.avatarURL} alt="" className="w-full h-full object-cover"/>
                      : getInitials(c.user?.name)}
                  </div>
                  <div className="flex-1 bg-forest rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-cream cursor-pointer hover:text-sage-l transition-colors"
                            onClick={() => navigate(`/users/${c.user?.id}`)}>
                        {c.user?.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">
                          {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                        {/* Verified answer badge */}
                        {verifiedId === c.id && (
                          <span className="text-[10px] text-gold border border-gold/30
                                           px-1.5 py-0.5 rounded-md flex-shrink-0">
                            ✓ Verified
                          </span>
                        )}
                        {/* Mark as verified — only the comment author if Expert */}
                        {user?.role === 'EXPERT' && c.user?.id === user?.id && verifiedId !== c.id && (
                          <button onClick={async () => {
                                    try {
                                      await api.post(
                                        `/expert/communities/${communityId}/posts/${item.dbId}/comments/${c.id}/verify`
                                      );
                                      setVerifiedId(c.id);
                                      toast.success('Marked as verified answer');
                                    } catch (err) { toast.error(getErrorMessage(err)); }
                                  }}
                                  className="text-[10px] text-muted hover:text-gold transition-colors">
                            Mark verified
                          </button>
                        )}
                        {(c.user?.id === user?.id || canAdmin) && (
                          <button onClick={() => handleDeleteComment(c.id)}
                                  className="text-[10px] text-muted hover:text-red-400 transition-colors">
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[13px] text-cream/85 leading-snug">{c.content}</p>
                  </div>
                </div>
              ))
            )}
            {/* Reply input */}
            {user && (
              <form onSubmit={handleReply} className="flex gap-2 mt-1">
                <div className="w-7 h-7 rounded-full flex-shrink-0 bg-gradient-to-br from-sage to-rust
                                flex items-center justify-center text-cream text-[10px] font-bold overflow-hidden">
                  {user?.avatarURL
                    ? <img src={user.avatarURL} alt="" className="w-full h-full object-cover"/>
                    : getInitials(user?.name)}
                </div>
                <div className="flex-1 flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)}
                         placeholder="Write a reply..."
                         maxLength={500}
                         className="flex-1 bg-forest border border-[rgba(74,124,89,0.2)] rounded-xl
                                    px-3 py-2 text-[13px] text-cream placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                  <button type="submit" disabled={!reply.trim() || posting}
                          className="px-3 py-2 bg-sage hover:bg-sage-l text-cream text-[12px] rounded-xl
                                     transition-colors disabled:opacity-50">
                    {posting ? '…' : 'Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────

const BackIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;

const PlusIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

const RemoveIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

const CameraIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;

const CommentIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;

const RecipeIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;