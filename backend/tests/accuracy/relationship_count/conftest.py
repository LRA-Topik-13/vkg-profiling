def academics_full_professor_ids(conn) -> list[int]:
    """Return academics teachers that are Full Professors and teach at least once."""
    cursor = conn.cursor(as_dict=True)
    cursor.execute(
        """
        SELECT DISTINCT t.t_id
        FROM teacher t
        JOIN teaching tg ON tg.t_id = t.t_id
        WHERE t.position = 1
        ORDER BY t.t_id
        """
    )
    return [row["t_id"] for row in cursor.fetchall()]


def add_extra_teaches_relationships(conn, teacher_ids: list[int], extras_per_teacher: int = 3) -> None:
    """Add distinct extra Teaches relationships for selected academics teachers."""
    cursor = conn.cursor(as_dict=True)
    update_cursor = conn.cursor()
    for teacher_id in teacher_ids:
        cursor.execute("SELECT c_id FROM teaching WHERE t_id = %s", (teacher_id,))
        existing = {row["c_id"] for row in cursor.fetchall()}
        extra_courses = [course_id for course_id in range(1, 41) if course_id not in existing]
        if len(extra_courses) < extras_per_teacher:
            raise RuntimeError(f"Not enough unused courses for teacher {teacher_id}.")
        for course_id in extra_courses[:extras_per_teacher]:
            update_cursor.execute(
                "INSERT INTO teaching (c_id, t_id) VALUES (%s, %s)",
                (course_id, teacher_id),
            )
    conn.commit()
