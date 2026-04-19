import supabase from "./supabase.js";

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Login error: " + error.message);
        return;
    }

    const user = data.user;
    console.log("Logged in user:", user.id);

    let { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (profileError) {
        console.log(profileError);
        alert("Error fetching profile");
        return;
    }

    if (!profile) {
        const { data: newProfile, error: insertError } = await supabase
            .from("users")
            .insert({
                user_id: user.id,
                role: "patient"
            })
            .select()
            .single();

        if (insertError) {
            console.log(insertError);
            alert("Error creating profile");
            return;
        }

        profile = newProfile;
    }

    console.log("User profile:", profile);

    if (profile.role === "patient") {
        window.location.href = "patient_dashboard.html";

    } else if (profile.role === "staff") {
        window.location.href = "dashboardStaff.html";

    } else if (profile.role === "admin") {
        window.location.href = "dashboardAdmin.html";

    } else {
        alert("Unknown role");
    }

});