-- MeChat Online Multiplayer Games Schema Migration
-- Table: game_rooms and trusted game action RPCs for 8-Ball Pool and Tic-Tac-Toe

-- 1. Create GAME ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.game_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    game_type TEXT NOT NULL CHECK (game_type IN ('pool', 'tic_tac_toe')),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
    host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    current_turn_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_version INTEGER NOT NULL DEFAULT 1,
    winner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rematch_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours')
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON public.game_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host ON public.game_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_guest ON public.game_rooms(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON public.game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_expires ON public.game_rooms(expires_at);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Select - Users can read rooms they participate in, OR waiting rooms to allow joining by code
CREATE POLICY "Users can view participating or joinable rooms"
    ON public.game_rooms
    FOR SELECT
    USING (
        auth.uid() = host_user_id OR
        auth.uid() = guest_user_id OR
        status = 'waiting'
    );

-- Policy: Insert - Authenticated users can create rooms as host
CREATE POLICY "Users can create rooms"
    ON public.game_rooms
    FOR INSERT
    WITH CHECK (auth.uid() = host_user_id);

-- Policy: Update - Only participants can update their active rooms
CREATE POLICY "Participants can update room"
    ON public.game_rooms
    FOR UPDATE
    USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

-- 3. REALTIME PUBLICATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'game_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
    END IF;
END $$;

-- 4. TRUSTED STORED PROCEDURES (RPC)

-- A. Create Game Room
CREATE OR REPLACE FUNCTION public.create_game_room(
    p_game_type TEXT,
    p_room_code TEXT,
    p_initial_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be signed in';
    END IF;

    -- Clean up any expired or abandoned waiting rooms created by this user
    UPDATE public.game_rooms
    SET status = 'cancelled', updated_at = NOW()
    WHERE host_user_id = v_user_id AND status = 'waiting';

    INSERT INTO public.game_rooms (
        room_code,
        game_type,
        status,
        host_user_id,
        current_turn_user_id,
        game_state,
        state_version
    ) VALUES (
        UPPER(TRIM(p_room_code)),
        p_game_type,
        'waiting',
        v_user_id,
        v_user_id,
        p_initial_state,
        1
    )
    RETURNING * INTO v_room;

    RETURN to_jsonb(v_room);
END;
$$;

-- B. Join Game Room
CREATE OR REPLACE FUNCTION public.join_game_room(
    p_room_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be signed in';
    END IF;

    -- Lock room row for atomic assignment
    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE room_code = UPPER(TRIM(p_room_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found with code %', p_room_code;
    END IF;

    IF v_room.status != 'waiting' THEN
        RAISE EXCEPTION 'Room is no longer waiting for players (status: %)', v_room.status;
    END IF;

    IF v_room.expires_at < NOW() THEN
        UPDATE public.game_rooms SET status = 'cancelled' WHERE id = v_room.id;
        RAISE EXCEPTION 'Room has expired';
    END IF;

    IF v_room.host_user_id = v_user_id THEN
        -- Host re-entering their own waiting room is acceptable
        RETURN to_jsonb(v_room);
    END IF;

    IF v_room.guest_user_id IS NOT NULL AND v_room.guest_user_id != v_user_id THEN
        RAISE EXCEPTION 'Room is already full';
    END IF;

    -- Assign guest and transition status to active
    UPDATE public.game_rooms
    SET 
        guest_user_id = v_user_id,
        status = 'active',
        updated_at = NOW(),
        state_version = v_room.state_version + 1
    WHERE id = v_room.id
    RETURNING * INTO v_room;

    RETURN to_jsonb(v_room);
END;
$$;

-- C. Submit Tic-Tac-Toe Move
CREATE OR REPLACE FUNCTION public.submit_tic_tac_toe_move(
    p_room_id UUID,
    p_cell_index INT,
    p_expected_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
    v_board JSONB;
    v_symbol TEXT;
    v_next_turn UUID;
    v_winner UUID := NULL;
    v_is_draw BOOLEAN := FALSE;
    v_winning_line INT[] := NULL;
    v_cells TEXT[];
    v_lines INT[][] := ARRAY[
        [0, 1, 2], [3, 4, 5], [6, 7, 8], -- Horizontal
        [0, 3, 6], [1, 4, 7], [2, 5, 8], -- Vertical
        [0, 4, 8], [2, 4, 6]             -- Diagonal
    ];
    v_line INT[];
    v_a TEXT; v_b TEXT; v_c TEXT;
    v_i INT;
    v_filled INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    IF v_room.status != 'active' THEN
        RAISE EXCEPTION 'Match is not active (status: %)', v_room.status;
    END IF;

    IF v_room.current_turn_user_id != v_user_id THEN
        RAISE EXCEPTION 'Not your turn';
    END IF;

    IF v_room.state_version != p_expected_version THEN
        RAISE EXCEPTION 'Stale state revision (expected %, got %)', p_expected_version, v_room.state_version;
    END IF;

    IF p_cell_index < 0 OR p_cell_index > 8 THEN
        RAISE EXCEPTION 'Invalid cell index %', p_cell_index;
    END IF;

    v_board := COALESCE(v_room.game_state->'board', '["", "", "", "", "", "", "", "", ""]'::jsonb);
    
    -- Extract cells array into text array
    v_cells := ARRAY[
        v_board->>0, v_board->>1, v_board->>2,
        v_board->>3, v_board->>4, v_board->>5,
        v_board->>6, v_board->>7, v_board->>8
    ];

    IF v_cells[p_cell_index + 1] IS NOT NULL AND v_cells[p_cell_index + 1] != '' THEN
        RAISE EXCEPTION 'Cell % is already occupied', p_cell_index;
    END IF;

    -- Host is always X, Guest is O
    IF v_user_id = v_room.host_user_id THEN
        v_symbol := 'X';
        v_next_turn := v_room.guest_user_id;
    ELSE
        v_symbol := 'O';
        v_next_turn := v_room.host_user_id;
    END IF;

    v_cells[p_cell_index + 1] := v_symbol;

    -- Check win conditions
    FOREACH v_line SLICE 1 IN ARRAY v_lines
    LOOP
        v_a := v_cells[v_line[1] + 1];
        v_b := v_cells[v_line[2] + 1];
        v_c := v_cells[v_line[3] + 1];
        IF v_a != '' AND v_a IS NOT NULL AND v_a = v_b AND v_b = v_c THEN
            v_winner := v_user_id;
            v_winning_line := v_line;
            EXIT;
        END IF;
    END LOOP;

    -- Count filled cells for draw
    FOR v_i IN 1..9 LOOP
        IF v_cells[v_i] IS NOT NULL AND v_cells[v_i] != '' THEN
            v_filled := v_filled + 1;
        END IF;
    END LOOP;

    IF v_winner IS NULL AND v_filled = 9 THEN
        v_is_draw := TRUE;
    END IF;

    -- Update room record
    UPDATE public.game_rooms
    SET
        game_state = jsonb_build_object(
            'board', to_jsonb(v_cells),
            'lastMove', p_cell_index,
            'winningLine', to_jsonb(v_winning_line),
            'isDraw', v_is_draw
        ),
        current_turn_user_id = CASE WHEN v_winner IS NOT NULL OR v_is_draw THEN NULL ELSE v_next_turn END,
        winner_user_id = v_winner,
        status = CASE WHEN v_winner IS NOT NULL OR v_is_draw THEN 'completed' ELSE 'active' END,
        state_version = v_room.state_version + 1,
        updated_at = NOW()
    WHERE id = v_room.id
    RETURNING * INTO v_room;

    RETURN to_jsonb(v_room);
END;
$$;

-- D. Submit Pool Shot State Transition
CREATE OR REPLACE FUNCTION public.submit_pool_shot(
    p_room_id UUID,
    p_shot_payload JSONB,
    p_settled_state JSONB,
    p_next_turn_user_id UUID,
    p_winner_user_id UUID,
    p_expected_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    IF v_room.status != 'active' THEN
        RAISE EXCEPTION 'Match is not active (status: %)', v_room.status;
    END IF;

    IF v_room.current_turn_user_id != v_user_id THEN
        RAISE EXCEPTION 'Not your turn';
    END IF;

    IF v_room.state_version != p_expected_version THEN
        RAISE EXCEPTION 'Stale state revision (expected %, got %)', p_expected_version, v_room.state_version;
    END IF;

    UPDATE public.game_rooms
    SET
        game_state = p_settled_state,
        current_turn_user_id = CASE WHEN p_winner_user_id IS NOT NULL THEN NULL ELSE p_next_turn_user_id END,
        winner_user_id = p_winner_user_id,
        status = CASE WHEN p_winner_user_id IS NOT NULL THEN 'completed' ELSE 'active' END,
        state_version = v_room.state_version + 1,
        updated_at = NOW()
    WHERE id = v_room.id
    RETURNING * INTO v_room;

    RETURN to_jsonb(v_room);
END;
$$;

-- E. Request / Accept Rematch
CREATE OR REPLACE FUNCTION public.request_rematch(
    p_room_id UUID,
    p_reset_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
    v_other_player UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    IF v_user_id != v_room.host_user_id AND v_user_id != v_room.guest_user_id THEN
        RAISE EXCEPTION 'Not a room participant';
    END IF;

    v_other_player := CASE WHEN v_user_id = v_room.host_user_id THEN v_room.guest_user_id ELSE v_room.host_user_id END;

    IF v_room.rematch_requested_by IS NOT NULL AND v_room.rematch_requested_by = v_other_player THEN
        -- Both players agreed to rematch: reset match state!
        UPDATE public.game_rooms
        SET
            status = 'active',
            game_state = p_reset_state,
            current_turn_user_id = v_room.host_user_id,
            winner_user_id = NULL,
            rematch_requested_by = NULL,
            state_version = v_room.state_version + 1,
            updated_at = NOW()
        WHERE id = v_room.id
        RETURNING * INTO v_room;
    ELSE
        -- Record single player's rematch request
        UPDATE public.game_rooms
        SET
            rematch_requested_by = v_user_id,
            updated_at = NOW()
        WHERE id = v_room.id
        RETURNING * INTO v_room;
    END IF;

    RETURN to_jsonb(v_room);
END;
$$;

-- F. Leave Game Room
CREATE OR REPLACE FUNCTION public.leave_game_room(
    p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_room public.game_rooms%ROWTYPE;
    v_opponent UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;

    IF v_room.status = 'active' THEN
        -- Forfeit: Award win to remaining player
        v_opponent := CASE WHEN v_user_id = v_room.host_user_id THEN v_room.guest_user_id ELSE v_room.host_user_id END;
        UPDATE public.game_rooms
        SET
            status = 'completed',
            winner_user_id = v_opponent,
            state_version = v_room.state_version + 1,
            updated_at = NOW()
        WHERE id = v_room.id
        RETURNING * INTO v_room;
    ELSIF v_room.status = 'waiting' THEN
        UPDATE public.game_rooms
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = v_room.id
        RETURNING * INTO v_room;
    END IF;

    RETURN to_jsonb(v_room);
END;
$$;
